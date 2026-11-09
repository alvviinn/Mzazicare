"""Shared paths and constants for the first-aid assistant."""
import os
from pathlib import Path

DATA = Path(os.environ.get('MZAZI_DATA', r'C:\mzazicare-data')) / 'firstaid'
RAW = DATA / 'raw'
HERE = Path(__file__).resolve().parent
KNOWLEDGE = HERE / 'knowledge'
ARTIFACTS = HERE / 'artifacts'

# The pretrained multilingual encoder that is fine-tuned (its vocabulary covers English and Kiswahili).
BASE_MODEL_NAME = 'intfloat/multilingual-e5-small'
# A local copy is used when present (C:\mzazicare-data\firstaid\e5-small); otherwise it is fetched from Hugging Face.
_LOCAL = DATA / 'e5-small'
BASE_MODEL = str(_LOCAL) if (_LOCAL / 'model.safetensors').exists() else BASE_MODEL_NAME
MAX_TOKENS = 64  # questions are short; longer text is cut

# Labels besides the first-aid topics in the guide.
OUT_OF_SCOPE = 'out_of_scope'  # not a first-aid question (weather, music, maths...)
GREETING = 'greeting'          # hello / thanks / bye
