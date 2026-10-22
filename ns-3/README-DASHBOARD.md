# ADE Network Intelligence
## *Adaptive Content Distribution and Network Performance Analytics*

A professional, real-time observability and simulation dashboard built for demonstrating the research project:
**"Adaptive Multi-Factor Content Distribution in Information-Centric Networks (ICN)"** using **ns-3.35** and **ndnSIM 2.8**.

## Shared real-time simulator

The dashboard now has a shared experiment room. A request entered in the **Issue an Interest** console is evaluated by the Python server, which maintains one ContentStore for the room and broadcasts the result to every connected browser. Repeating a name demonstrates the cache transition directly:

```text
first request  -> CACHE_MISS -> Producer P0 -> stored in ContentStore
repeat request -> CACHE_HIT  -> Router R3 ContentStore -> lower latency
```

Run the shared server from the repository root:

```powershell
python backend\server.py
```

Open `http://localhost:8000/dashboard/`. For a friend on the same Wi-Fi, find this computer's IPv4 address with `ipconfig` and open `http://<your-ip>:8000/dashboard/`; use the same room name (default `ADE-DEMO`). Both browsers should show the same participant count, cache contents, popularity, request rows, metrics, and packet animation. Windows Firewall may need to allow Python on private networks.

---

## 🌟 Quick Demonstration Guide for Supervisor Review ("Mam")

### Step 1: Open the Dashboard in Your Browser
On Windows, navigate to:
```text
D:\Programming\networks\ndnSIM\ns-3\ade-network-intelligence\index.html
```
Double-click to open in **Google Chrome**, **Microsoft Edge**, or **Firefox**.  
*(Alternatively, double-click `D:\Programming\networks\ndnSIM\ns-3\index.html`)*

### Step 2: Run the 12-Step Guided Supervisor Scenario
In the top right corner of the dashboard, click:
> 🚀 **"Run Supervisor Demo"**

This initiates the automated, deterministic scenario:
**"Adaptive Route Selection Under Changing Network Conditions"**

Watch the guided scenario step through 12 stages with real-time narration:
1. **Initial Baseline:** Consumer C0 requests content over Path A (18ms delay, 100% PDR).
2. **Traffic Generation:** Interests stream at 15 req/sec; ContentStore caches payloads.
3. **Congestion Injection:** A bottleneck is injected on Path A (throttled to 200 Kbps, delay spikes to 95ms, DropTail queue fills).
4. **ADE Detection:** The Adaptive Decision Engine intercepts the degraded metrics via the NFD `afterReceiveInterest()` trigger.
5. **Multi-Factor Evaluation:** ADE computes normalized utility scores for eligible next hops.
6. **Path Shift:** Path B beats Path A by > 15% (anti-flapping margin). Traffic reroutes to Face 259 (Router R2) in under 25ms!
7. **Performance Recovery:** Latency immediately recovers to 35ms; PDR restores to 99.4%.
8. **Cache Hit Verification:** Requests for `/dataset/research/chunk12` satisfy directly at Router R3 ContentStore.
9. **Final Benchmark:** Overview & Comparison tables display quantitative deltas against Baseline BestRoute.

---

## 🏛️ System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   ADE Network Intelligence Dashboard                    │
│      (HTML5 Canvas Topology + SVG Charts + Reactive State Machine)      │
└───────────────────▲────────────────────────────────▲───────────────────┘
                    │ WebSocket / REST API           │ Fallback Mode
                    │ (ws://localhost:8000/ws)       │ (Client State Machine)
┌───────────────────┴────────────────────────────────┴───────────────────┐
│              Python FastAPI Backend Adapter (backend/server.py)         │
│             - Polls build/ade-rate-trace.txt & NFD Log Stream          │
│             - Translates ndnSIM telemetry to JSON messages             │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ IPC / File Tracing
┌───────────────────────────────────┴────────────────────────────────────┐
│            C++ ns-3.35 / ndnSIM 2.8 Forwarding Simulator               │
│   - Custom NFD Strategy: src/ndnSIM/NFD/daemon/fw/ade-strategy.cpp     │
│   - Multi-Path Scenario: src/ndnSIM/examples/ndn-ade-multipath.cpp     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📑 Required Pages & Dashboard Modules

### 1. Overview Dashboard (`#tab-overview`)
- **8 Real-Time KPI Cards:** Average End-to-End Delay (EWMA), Packet Delivery Ratio (PDR %), ContentStore Cache Hit %, Throughput (Mbps), Interests Sent, Data Received, ADE Decisions Count, Active Next-Hop Path.
- Real-time animated charts for Latency and Throughput.
- Explicit Data Provenance Tag (`DATA PROVENANCE: DEMO SCENARIO` or `DATA PROVENANCE: LIVE ndnSIM`).

### 2. Interactive Network Topology (`#tab-topology`)
- **Nodes:** Consumer (C0), Router R0 (ADE Forwarder), Router R1 (Path A), Router R2 (Path B), Router R3 (Edge Cache), Producer (P0).
- **Packet Flow Visualizer:**
  - **Cyan:** Interest packets moving upstream.
  - **Green:** Data packets returning downstream.
  - **Purple:** Cache Hit Data returning directly from Router R3.
  - **Red:** Packet drops / buffer overflows.
- **Node & Link Inspector:** Click any router or link to inspect live parameters in the side drawer.

### 3. Simulation Controls & Fault Injection (`#tab-controls`)
- Interactive sliders for Propagation Delay and Packet Loss.
- One-Click Stress Scenarios:
  - 🟢 Normal Operating State
  - 🔴 Path A Congestion Spike (95ms delay, 90% queue occupancy)
  - ⚠️ Path B Packet Loss Spike (15% loss)
  - 💾 Path C Cache Saturation (92% cache hit)

### 4. Adaptive Decision Engine (ADE) (`#tab-ade`)
- Multi-Criteria Decision Matrix (MCDM) table showing normalized scores for all candidate paths.
- Active Selection Banner highlighting the winning face and mathematical rationale.
- Dynamic weight sliders with weight validation ($\sum w_i = 1.0$) and preset profiles (Latency-Critical, Cache-CDN, Cost-Optimized).

### 5. Content Request Explorer (`#tab-explorer`)
- Real-time tabular feed of named NDN content:
  - `/video/news/segment1`
  - `/video/sports/segment4`
  - `/dataset/research/chunk12`
  - `/iot/temperature/region1`
- Filter by status (`SATISFIED`, `CACHE_HIT`, `PACKET_DROP`) and prefix search.

### 6. Performance Analytics (`#tab-analytics`)
- High-performance, zero-CDN canvas charts:
  - Latency vs Time (ADE vs Baseline BestRoute)
  - Instantaneous Throughput vs Time (Mbps)
  - Packet Delivery Ratio (%)

### 7. Baseline vs ADE Comparison (`#tab-baseline`)
- Side-by-side benchmark table with quantitative gains:
  - $\text{Latency Improvement} = \frac{\text{BaselineDelay} - \text{ADEDelay}}{\text{BaselineDelay}} \times 100$ (**-63.7%**)
  - Percentiles: p50 (median), p95 (tail), p99.
  - Delivery ratio gain (+20.9% PDR).

### 8. Live Event Logs (`#tab-logs`)
- Searchable, timestamped event log stream with tags:
  - `INFO`, `DECISION`, `PATH_CHANGE`, `CONGESTION`, `DROP`, `CACHE`.

### 9. ndnSIM Connector Config (`#tab-config`)
- Technical documentation detailing the REST / WebSocket contracts and commands to run the Python backend adapter.

---

## 💻 How to Run the Backend Connector (Optional)

If you wish to run the Python backend and feed live trace files into the dashboard:

```bash
# 1. Navigate to backend directory
cd /mnt/d/Programming/networks/ndnSIM/ns-3/backend

# 2. Install Python dependencies (if not installed)
pip install -r requirements.txt

# 3. Start the FastAPI server
python3 server.py
```
Then click the **"Operation Mode"** toggle in the dashboard sidebar to connect over WebSocket (`ws://localhost:8000/ws`).

---

## 🔬 Mathematical Formulation

The ADE engine evaluates candidate upstream faces using a multi-criteria cost function:

$$\text{Score}(Face_j) = w_d \cdot \hat{D}_j + w_l \cdot \hat{L}_j + w_c \cdot \hat{C}_j + w_b \cdot \hat{B}_j + w_h \cdot \hat{H}_j + w_q \cdot \hat{Q}_j$$

Where:
- $\hat{D}_j$: Min-Max normalized delay (Cost criterion)
- $\hat{L}_j$: Min-Max normalized packet loss (Cost criterion)
- $\hat{C}_j$: Normalized FIB link cost (Cost criterion)
- $\hat{B}_j$: Normalized link bandwidth (Benefit criterion, inverted)
- $\hat{H}_j$: Normalized cache hit ratio (Benefit criterion, inverted)
- $\hat{Q}_j$: Normalized DropTail queue depth (Cost criterion)

### Anti-Flapping Hysteresis Margin
$$\text{Score}_{\text{new}} \le \text{Score}_{\text{active}} \times (1 - 0.15)$$
Prevents rapid route oscillations when two paths exhibit similar performance.

---
*Created for the Adaptive Multi-Factor Content Distribution Research Project.*
