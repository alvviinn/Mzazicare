"""Gunicorn reads this file automatically (it is in the folder the server starts from).

The first-aid model takes several seconds to load (longer on a small cloud plan). Without this, the first person to
ask a first-aid question after every restart waits for that load. Each worker now loads it in the background as soon
as it starts, so it is ready before anyone asks; a request that arrives during the load waits for it (no double load).
"""

import logging
import threading
import time

log = logging.getLogger('gunicorn.error')


def _warm_first_aid(pid):
    start = time.monotonic()
    try:
        from care.firstaid_views import get_assistant

        get_assistant().reply(message='warm up')  # also runs the model once, so its first real answer is fast
        log.info('first-aid model ready in worker %s after %.1fs', pid, time.monotonic() - start)
    except Exception:  # never stop the worker: first aid then loads on its first request as before
        log.exception('first-aid model warm-up failed in worker %s', pid)


def post_worker_init(worker):
    threading.Thread(target=_warm_first_aid, args=(worker.pid,), daemon=True, name='firstaid-warmup').start()
