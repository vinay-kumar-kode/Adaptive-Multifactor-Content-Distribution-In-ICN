# Adaptive Multifactor Content Distribution in ICN

This repository contains an ns-3.35/ndnSIM research project implementing an
Adaptive Decision Engine (ADE) for content-aware and congestion-aware path
selection in Named Data Networking.

## Repository layout

```text
ns-3/
|-- src/ndnSIM/NFD/daemon/fw/       # ADE forwarding strategy
|-- src/ndnSIM/examples/            # ADE and ndnSIM simulation scenarios
|-- ade-network-intelligence/       # Browser dashboard
|-- backend/                        # FastAPI/WebSocket dashboard server
|-- project-report/                 # Project report sources, when present
|-- README-ADE.md                   # Technical project documentation
`-- README-DASHBOARD.md             # Dashboard guide
pybindgen/                          # Python binding generator dependency
```

The `build/` directory is generated locally and is intentionally excluded
from GitHub.

## Run the dashboard on Windows

From PowerShell:

```powershell
cd ns-3
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
python backend\server.py
```

Open <http://localhost:8000/dashboard/> in a browser.

## Build and run the simulator on Linux or WSL

```bash
cd ns-3
./waf configure --enable-examples
./waf
./waf --run ndn-ade-multipath
```

The exact dependencies required by ns-3/ndnSIM depend on the operating
system. See `ns-3/README.md` for the upstream simulator build information.

## Push this repository to GitHub

Run these commands from the repository root. Replace the remote URL only if
you are using a different GitHub repository:

```bash
git status
git add -A
git commit -m "Organize ADE ndnSIM project"
git branch -M main
git remote -v
git push -u origin main
```

For a new GitHub repository, set its URL before pushing:

```bash
git remote set-url origin https://github.com/<your-username>/<repository-name>.git
git push -u origin main
```
