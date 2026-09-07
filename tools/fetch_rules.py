from pathlib import Path
from urllib.request import Request, urlopen

sources = {
    'base': 'https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf',
    'ix-tleilaxu': 'https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf',
    'choam-richese': 'https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf',
    'ecaz-moritani': 'https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf',
    'faq': 'https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf',
}
root = Path('/tmp/dune-rules')
root.mkdir(exist_ok=True)
for name, url in sources.items():
    try:
        with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30) as response:
            data = response.read()
        if not data.startswith(b'%PDF'):
            raise ValueError('Response is not a PDF')
        (root / f'{name}.pdf').write_bytes(data)
        print(name, len(data), flush=True)
    except Exception as error:
        print(name, str(error), flush=True)
