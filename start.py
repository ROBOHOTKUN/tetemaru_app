"""このファイルを開くと、ローカルのブラウザで試作が開きます。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import urlopen
import webbrowser
import argparse
import socket

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--lan", action="store_true", help="同じLAN内のスマートフォンから試す")
    lan = parser.parse_args().lan
    folder = Path(__file__).resolve().parent
    handler = partial(SimpleHTTPRequestHandler, directory=str(folder))
    port = 18764 if lan else 18763
    host = "0.0.0.0" if lan else "127.0.0.1"
    try:
        server = ThreadingHTTPServer((host, port), handler)
    except OSError:
        try:
            with urlopen(f"http://127.0.0.1:{port}/pink-pal.glb", timeout=2) as response:
                with (folder / "pink-pal.glb").open("rb") as model:
                    same = response.read(256) == model.read(256)
        except OSError:
            same = False
        if same and not lan:
            webbrowser.open(f"http://127.0.0.1:{port}/trial.html")
            return
        server = ThreadingHTTPServer((host, 0), handler)
    with server:
        address = f"http://127.0.0.1:{server.server_port}/trial.html"
        print(address, flush=True)
        if lan:
            for ip in sorted(set(socket.gethostbyname_ex(socket.gethostname())[2])):
                if not ip.startswith("127."):
                    print(f"LAN: http://{ip}:{server.server_port}/trial.html", flush=True)
        webbrowser.open(address)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass

if __name__ == "__main__":
    main()

