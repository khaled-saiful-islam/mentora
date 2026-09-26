"""Work that outlives the request that started it — a learning set being made.

Like `live_turns`, but for anything that emits plain JSON events: the job runs
in its own task and writes each event into a buffer; connections *follow* it,
getting everything from the first event and then the rest live. A follower
leaving cancels the follower, never the job. In-process, so one worker —
the same constraint, and the same one place to lift it.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from typing import Any, Protocol
from uuid import UUID

logger = logging.getLogger(__name__)

# How long a finished job stays joinable. After that its result is in the
# database, which is where a latecomer should read it.
KEEP_FINISHED_SECONDS = 300

Event = dict[str, Any]


class JobWatcher(Protocol):
    """Something that follows a job from outside: the work board, which shows
    its owner how far along it is and tells them when it is done."""

    def seen(self, event: Event) -> None: ...

    async def ended(self) -> None: ...


class Job:
    def __init__(self, job_id: UUID, owner_id: UUID) -> None:
        self.job_id = job_id
        self.owner_id = owner_id
        self.task: asyncio.Task[None] | None = None
        self._events: list[Event] = []
        self._bell = asyncio.Event()
        self._done = False

    @property
    def done(self) -> bool:
        return self._done

    def append(self, event: Event) -> None:
        self._events.append(event)
        self._ring()

    def finish(self) -> None:
        self._done = True
        self._ring()

    def _ring(self) -> None:
        self._bell.set()
        self._bell = asyncio.Event()

    async def follow(self) -> AsyncIterator[Event]:
        seen = 0
        while True:
            while seen < len(self._events):
                yield self._events[seen]
                seen += 1
            if self._done:
                return
            await self._bell.wait()


class JobRunner:
    def __init__(self) -> None:
        self._jobs: dict[UUID, Job] = {}

    def start(
        self,
        job_id: UUID,
        owner_id: UUID,
        source: AsyncIterator[Event],
        watcher: JobWatcher | None = None,
    ) -> Job:
        existing = self._jobs.get(job_id)
        if existing is not None and not existing.done:
            return existing
        job = Job(job_id, owner_id)
        self._jobs[job_id] = job
        job.task = asyncio.create_task(self._pump(job, source, watcher), name=f"job-{job_id}")
        return job

    def find(self, job_id: UUID, owner_id: UUID) -> Job | None:
        job = self._jobs.get(job_id)
        return job if job is not None and job.owner_id == owner_id else None

    async def _pump(
        self, job: Job, source: AsyncIterator[Event], watcher: JobWatcher | None
    ) -> None:
        try:
            async for event in source:
                job.append(event)
                _tell(watcher, event)
        except asyncio.CancelledError:
            # Shutting down: the job is abandoned, not finished, so the
            # watcher is not asked to announce it.
            job.append({"type": "failed", "message": "This was stopped before it finished."})
            raise
        except Exception:
            # Deliberately broad: whatever went wrong, the followers are told
            # plainly and the detail stays in the log.
            logger.exception("job %s failed", job.job_id)
            failed = {"type": "failed", "message": "Something went wrong. Please try again."}
            job.append(failed)
            _tell(watcher, failed)
        finally:
            job.finish()
            asyncio.get_running_loop().call_later(KEEP_FINISHED_SECONDS, self._forget, job)
        if watcher is not None:
            try:
                await watcher.ended()
            except Exception:
                # The job's result is saved; only the telling failed.
                logger.exception("watcher of job %s failed", job.job_id)

    def _forget(self, job: Job) -> None:
        if self._jobs.get(job.job_id) is job:
            self._jobs.pop(job.job_id, None)

    async def close_all(self) -> None:
        running = [j.task for j in self._jobs.values() if j.task is not None and not j.task.done()]
        for task in running:
            task.cancel()
        await asyncio.gather(*running, return_exceptions=True)


def _tell(watcher: JobWatcher | None, event: Event) -> None:
    if watcher is None:
        return
    try:
        watcher.seen(event)
    except Exception:
        # A watcher is a bystander: its failure never touches the job.
        logger.exception("job watcher failed on %s", event.get("type"))


jobs = JobRunner()
