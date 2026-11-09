"""Download the public datasets used to train the first-aid assistant's question understanding.

    python -m firstaid.get_data

Everything goes to C:\\mzazicare-data\\firstaid\\raw (override with MZAZI_DATA). Skips files already there.
The datasets only teach the model how people *ask* about first aid (and what is not a first-aid question). The
advice it gives comes from the vetted guide in firstaid/knowledge, never from these datasets.
"""
import tarfile
import urllib.request
from pathlib import Path

from huggingface_hub import hf_hub_download

from .config import RAW

HF = {
    # first-aid questions in English (licences in docs/DATA.md)
    'i-am-mushfiq/FirstAidQA': ['firstaidqa_v1.json', 'README.md', 'LICENSE'],
    'badri55/First_aid__dataset': ['first_aid1.json'],
    'belvisk/First-Aid-Dataset': ['merged_data.csv', 'README.md'],
    'alexxxmf/firstaid_qa': ['train.jsonl', 'README.md'],
    'Baddoub/First-Aid-Dataset': ['training/merged_data.csv', 'validation/merged_data.csv'],
    'adv010/first-aid-synth': ['data/train-00000-of-00001.parquet', 'data/test-00000-of-00001.parquet', 'README.md'],
    'nuhmanpk/firstaid-treatment-instruct': ['README.md', 'data/train-00000-of-00001.parquet', 'data/eval-00000-of-00001.parquet'],
    'lextale/FirstAidInstructionsDataset': ['README.md', 'data/FirstAidQA-00000-of-00001.parquet', 'data/MedQuAD-00000-of-00001.parquet'],
    'sweatSmile/medical-symptom-triage-conversational': ['README.md', 'data/train-00000-of-00001.parquet'],
    # things that are NOT first-aid questions (so the assistant can say so instead of guessing)
    'clinc/clinc_oos': ['plus/train-00000-of-00001.parquet', 'plus/validation-00000-of-00001.parquet',
                        'plus/test-00000-of-00001.parquet', 'README.md'],
}
# Amazon MASSIVE: everyday requests in 51 languages, including Kiswahili (sw-KE). CC BY 4.0.
MASSIVE_URL = 'https://amazon-massive-nlu-dataset.s3.amazonaws.com/amazon-massive-dataset-1.1.tar.gz'
MASSIVE_KEEP = ('en-US.jsonl', 'sw-KE.jsonl', 'LICENSE')


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    for repo, files in HF.items():
        target = RAW / repo.replace('/', '__')
        for f in files:
            if not (target / f).exists():
                hf_hub_download(repo, f, repo_type='dataset', local_dir=target)
        print('ok', repo)
    tar = RAW / 'massive.tar.gz'
    if not tar.exists():
        urllib.request.urlretrieve(MASSIVE_URL, tar)
    out = RAW / 'massive'
    if not (out / 'sw-KE.jsonl').exists():
        out.mkdir(exist_ok=True)
        with tarfile.open(tar) as t:
            for m in t.getmembers():
                name = Path(m.name).name
                if m.isfile() and name in MASSIVE_KEEP:
                    m.name = name  # flatten, and never write outside `out`
                    t.extract(m, out, filter='data')
    print('ok massive')


if __name__ == '__main__':
    main()
