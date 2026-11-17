"""Reproduce a CI test job locally without installing anything (Automation agent).

The CI "ML" job runs `pip install numpy scipy soundfile onnxruntime` (.github/workflows/ci.yml). This runner works
out, offline from the installed package metadata, the dependency closure of those packages (what pip would install),
blocks the import of every other installed third-party package, runs `unittest discover` the way CI does from the
ml/ folder, and prints which imports were blocked.

Usage (from ml/):
  python run_like_ci_ml_job.py                                # voice/tests with the CI packages (current CI job)
  python run_like_ci_ml_job.py firstaid/tests                 # another suite with the CI packages
  python run_like_ci_ml_job.py voice/tests torch scikit-learn # also install these (a proposed CI change)
"""

import importlib.abc
import importlib.metadata as md
import re
import sys
import unittest

CI_PACKAGES = ['numpy', 'scipy', 'soundfile', 'onnxruntime']


def norm(name):
    return re.sub(r'[-_.]+', '-', name).lower()


def closure(roots):
    """Distributions pip would install for these roots (requirements without extras, markers evaluated)."""
    seen, todo = set(), [norm(r) for r in roots]
    while todo:
        name = todo.pop()
        if name in seen:
            continue
        try:
            dist = md.distribution(name)
        except md.PackageNotFoundError:
            continue
        seen.add(name)
        for req in dist.requires or []:
            if 'extra ==' in req:
                continue
            spec, _, marker = req.partition(';')
            if marker.strip():
                try:
                    from packaging.markers import Marker
                    if not Marker(marker).evaluate():
                        continue
                except Exception:
                    pass
            todo.append(norm(re.split(r'[\s<>=!~\[(]', spec.strip(), maxsplit=1)[0]))
    return seen


suite_dir = sys.argv[1] if len(sys.argv) > 1 else 'voice/tests'
extra = sys.argv[2:]
installed_ok = closure(CI_PACKAGES + extra)
blocked = {}
for top, dists in md.packages_distributions().items():
    if not any(norm(d) in installed_ok for d in dists):
        blocked[top] = dists[0]
blocked_seen = []


class Block(importlib.abc.MetaPathFinder):
    def find_spec(self, name, path=None, target=None):
        top = name.split('.')[0]
        if top in blocked:
            if blocked[top] not in blocked_seen:
                blocked_seen.append(blocked[top])
            raise ModuleNotFoundError(f"No module named '{name}' (blocked: {blocked[top]} is not installed in this CI job)")
        return None


sys.meta_path.insert(0, Block())
sys.path.insert(0, '.')
print(f'suite: {suite_dir}; pip install {" ".join(CI_PACKAGES + extra)}', flush=True)
print(f'would be installed ({len(installed_ok)}): {", ".join(sorted(installed_ok))}', flush=True)
suite = unittest.defaultTestLoader.discover(suite_dir, top_level_dir='.')
result = unittest.TextTestRunner(verbosity=2).run(suite)
print(f'blocked imports seen: {blocked_seen or "none"}')
sys.exit(0 if result.wasSuccessful() else 1)
