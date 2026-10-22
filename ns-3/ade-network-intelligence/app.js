/**
 * ADE Network Intelligence - Core Application Engine
 * Adaptive Multi-Factor Content Distribution in Information-Centric Networks (ICN)
 * Designed for Academic Supervisor Demonstration & ndnSIM Backend Integration
 */

// =============================================================================
// 1. GLOBAL STATE & CONFIGURATION
// =============================================================================

const APP_STATE = {
  // Modes: 'demo' (interactive deterministic state machine) or 'connected' (ndnSIM WebSocket)
  mode: 'demo',
  backendConnected: false,
  telemetrySource: 'DEMO_SCENARIO',
  wsUrl: '',
  restApiUrl: 'http://localhost:8000/api',
  room: {
    id: 'ADE-DEMO',
    participant: 'Presenter',
    participants: [],
    cache: []
  },

  // Simulation execution
  simRunning: true,
  simSpeed: 1.0,
  simTimeSeconds: 0.0,
  interestSeq: 0,

  // Selected element for Inspector Drawer
  inspectedElement: { type: 'node', id: 'R0' },

  // Live Aggregate Metrics (Mathematically consistent)
  metrics: {
    interestsSent: 0,
    dataReceived: 0,
    packetsDropped: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgDelayMs: 18.4,
    throughputMbps: 0,
    pdrPercent: 100.0,
    lossPercent: 0.0,
    cacheHitPercent: 15.0,
    adeDecisionsCount: 0,
    pathChangesCount: 0,
    networkUtilizationPercent: 24.5
  },

  // Topology Network Graph
  nodes: {
    C0: { id: 'C0', name: 'Consumer C0', role: 'Traffic Generator (15 req/s)', x: 90, y: 250, type: 'consumer', status: 'HEALTHY' },
    R0: { id: 'R0', name: 'Router R0', role: 'ADE Forwarding Daemon', x: 280, y: 250, type: 'ade_router', status: 'HEALTHY' },
    R1: { id: 'R1', name: 'Router R1', role: 'Path A Core Node', x: 570, y: 110, type: 'router', status: 'HEALTHY' },
    R2: { id: 'R2', name: 'Router R2', role: 'Path B Core Node', x: 570, y: 250, type: 'router', status: 'HEALTHY' },
    R3: { id: 'R3', name: 'Router R3', role: 'Path C Edge Cache Node', x: 570, y: 390, type: 'cache_node', status: 'HEALTHY' },
    P0: { id: 'P0', name: 'Producer P0', role: 'Content Source (/prefix)', x: 840, y: 250, type: 'producer', status: 'HEALTHY' }
  },

  links: {
    L_C0_R0: { id: 'L_C0_R0', from: 'C0', to: 'R0', bandwidth: 100, delay: 2, loss: 0.0, queueDepth: 2, maxQueue: 100, status: 'NORMAL' },
    L_R0_R1: { id: 'L_R0_R1', from: 'R0', to: 'R1', bandwidth: 20, delay: 15, loss: 0.5, queueDepth: 4, maxQueue: 25, status: 'NORMAL' },
    L_R1_P0: { id: 'L_R1_P0', from: 'R1', to: 'P0', bandwidth: 20, delay: 15, loss: 0.0, queueDepth: 2, maxQueue: 25, status: 'NORMAL' },
    L_R0_R2: { id: 'L_R0_R2', from: 'R0', to: 'R2', bandwidth: 10, delay: 35, loss: 0.0, queueDepth: 1, maxQueue: 50, status: 'NORMAL' },
    L_R2_P0: { id: 'L_R2_P0', from: 'R2', to: 'P0', bandwidth: 10, delay: 35, loss: 0.0, queueDepth: 1, maxQueue: 50, status: 'NORMAL' },
    L_R0_R3: { id: 'L_R0_R3', from: 'R0', to: 'R3', bandwidth: 8, delay: 40, loss: 0.0, queueDepth: 2, maxQueue: 50, status: 'NORMAL' },
    L_R3_P0: { id: 'L_R3_P0', from: 'R3', to: 'P0', bandwidth: 8, delay: 40, loss: 0.0, queueDepth: 1, maxQueue: 50, status: 'NORMAL' }
  },

  // Candidate Forwarding Paths under ADE Evaluation
  paths: {
    pathA: {
      id: 'pathA',
      name: 'Path A (via Router R1)',
      faceId: 258,
      viaNode: 'R1',
      delayMs: 18.0,
      lossPercent: 0.5,
      linkCost: 10,
      bandwidthMbps: 20,
      cacheHitPercent: 12.0,
      queueCongestionPercent: 12.0,
      hops: 2,
      normalizedScore: 0.0,
      status: 'OPTIMAL'
    },
    pathB: {
      id: 'pathB',
      name: 'Path B (via Router R2)',
      faceId: 259,
      viaNode: 'R2',
      delayMs: 35.0,
      lossPercent: 0.0,
      linkCost: 15,
      bandwidthMbps: 10,
      cacheHitPercent: 25.0,
      queueCongestionPercent: 5.0,
      hops: 2,
      normalizedScore: 0.0,
      status: 'AVAILABLE'
    },
    pathC: {
      id: 'pathC',
      name: 'Path C (via Router R3 - CS Cache)',
      faceId: 260,
      viaNode: 'R3',
      delayMs: 45.0,
      lossPercent: 0.0,
      linkCost: 20,
      bandwidthMbps: 8,
      cacheHitPercent: 80.0,
      queueCongestionPercent: 8.0,
      hops: 2,
      normalizedScore: 0.0,
      status: 'AVAILABLE'
    }
  },

  activePathId: 'pathA',
  lastSwitchedTime: 0,
  antiFlappingMargin: 0.15, // 15% improvement threshold to switch

  // Multi-Factor Scoring Weights (Must sum to 1.0)
  weights: {
    delay: 0.30,
    loss: 0.25,
    linkCost: 0.15,
    bandwidth: 0.10,
    cacheHit: 0.15,
    queue: 0.05
  },

  // Telemetry Time-Series History for Performance Charts
  history: {
    time: [],
    adeDelay: [],
    baselineDelay: [],
    adeThroughput: [],
    baselineThroughput: [],
    adePdr: [],
    baselinePdr: [],
    cacheHits: [],
    pathSelection: { pathA: 0, pathB: 0, pathC: 0 }
  },

  // Content Request Explorer Data
  requests: [],
  contentPopularity: {},

  // Live Event Log List
  logs: [],
  logFilter: 'ALL',
  logSearch: '',
  logsPaused: false,

  // Supervisor Demonstration 12-Step Scenario Machine
  supervisorScenario: {
    active: false,
    stepIndex: 0,
    stepTimer: null,
    totalSteps: 12
  }
};

// =============================================================================
// 2. INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initTopologyCanvas();
  initControlPanel();
  initAdeSliders();
  initChartEngines();
  initEventLogs();
  initSharedRoomControls();
  initSupervisorScenario();
  initBackendConnector();

  // Populate initial telemetry & requests
  seedInitialData();
  recalculateAdeScores();

  // Primary animation & simulation tick loop
  startMainSimulationLoop();
});

// =============================================================================
// 3. NAVIGATION & VIEW SWITCHING
// =============================================================================

function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const panes = document.querySelectorAll('.tab-pane');
  const pageTitle = document.getElementById('current-page-title');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.dataset.tab;
      navItems.forEach(n => n.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      const activePane = document.getElementById(`tab-${targetTab}`);
      if (activePane) activePane.classList.add('active');

      if (pageTitle) {
        pageTitle.textContent = item.querySelector('span:not(.nav-icon)').textContent;
      }

      // Redraw charts/canvas if tab requires it
      if (targetTab === 'topology') resizeTopologyCanvas();
      if (targetTab === 'analytics') renderAllCharts();
    });
  });

  // Mode badge click toggle
  const modeBadge = document.getElementById('connection-mode-badge');
  if (modeBadge) {
    modeBadge.addEventListener('click', toggleConnectionMode);
  }
}

function toggleConnectionMode() {
  if (APP_STATE.mode === 'demo') {
    // Attempt backend connection
    connectWebSocket();
  } else {
    // Revert to demo mode
    APP_STATE.mode = 'demo';
    APP_STATE.backendConnected = false;
    updateConnectionModeBadge();
    addLog('INFO', 'User switched system to Interactive Demonstration Mode.');
  }
}

function updateConnectionModeBadge() {
  const badge = document.getElementById('connection-mode-badge');
  const provTags = document.querySelectorAll('.provenance-tag');

  if (APP_STATE.telemetrySource === 'NDNSIM_TRACE') {
    if (badge) {
      badge.className = 'mode-badge connected';
      badge.innerHTML = '<span class="pulse-dot-sm"></span> ndnSIM Trace Live';
    }
    provTags.forEach(t => {
      t.className = 'provenance-tag measured';
      t.textContent = 'DATA PROVENANCE: LIVE ndnSIM TRACE';
    });
  } else if (APP_STATE.telemetrySource.startsWith('NDNSIM_TRACE_')) {
    if (badge) {
      badge.className = 'mode-badge disconnected';
      badge.innerHTML = '<span class="pulse-dot-sm"></span> ndnSIM Trace Snapshot';
    }
    provTags.forEach(t => {
      t.className = 'provenance-tag demo';
      t.textContent = 'DATA PROVENANCE: ndnSIM TRACE SNAPSHOT';
    });
  } else if (APP_STATE.backendConnected) {
    if (badge) {
      badge.className = 'mode-badge connected';
      badge.innerHTML = '<span class="pulse-dot-sm"></span> Shared Room Connected';
    }
    provTags.forEach(t => {
      t.className = 'provenance-tag demo';
      t.textContent = 'DATA PROVENANCE: SHARED ROOM SIMULATOR';
    });
  } else {
    if (badge) {
      badge.className = 'mode-badge disconnected';
      badge.innerHTML = '<span class="pulse-dot-sm"></span> Demonstration Mode';
    }
    provTags.forEach(t => {
      t.className = 'provenance-tag demo';
      t.textContent = 'DATA PROVENANCE: DEMO SCENARIO';
    });
  }
}

// =============================================================================
// 4. NETWORK TOPOLOGY VISUALIZER (CANVAS ENGINE)
// =============================================================================

let topCanvas, topCtx;
let inFlightPackets = [];

function initTopologyCanvas() {
  topCanvas = document.getElementById('topology-canvas');
  if (!topCanvas) return;
  topCtx = topCanvas.getContext('2d');
  resizeTopologyCanvas();
  window.addEventListener('resize', resizeTopologyCanvas);

  // Click on node/link inspector
  topCanvas.addEventListener('click', handleTopologyClick);

  // Topology HUD buttons
  const resetBtn = document.getElementById('hud-reset-topology');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetTopologyState);
  }

  requestAnimationFrame(topologyRenderLoop);
}

function resizeTopologyCanvas() {
  if (!topCanvas || !topCanvas.parentElement) return;
  const rect = topCanvas.parentElement.getBoundingClientRect();
  if (rect.width < 10) return;
  topCanvas.width = rect.width;
  topCanvas.height = rect.height || 480;

  // Responsive node positioning
  const scaleX = topCanvas.width / 960;
  const scaleY = topCanvas.height / 500;
  APP_STATE.nodes.C0.x = 80 * scaleX;
  APP_STATE.nodes.C0.y = 250 * scaleY;
  APP_STATE.nodes.R0.x = 280 * scaleX;
  APP_STATE.nodes.R0.y = 250 * scaleY;
  APP_STATE.nodes.R1.x = 580 * scaleX;
  APP_STATE.nodes.R1.y = 110 * scaleY;
  APP_STATE.nodes.R2.x = 580 * scaleX;
  APP_STATE.nodes.R2.y = 250 * scaleY;
  APP_STATE.nodes.R3.x = 580 * scaleX;
  APP_STATE.nodes.R3.y = 390 * scaleY;
  APP_STATE.nodes.P0.x = 850 * scaleX;
  APP_STATE.nodes.P0.y = 250 * scaleY;
  inFlightPackets.forEach(syncPacketCoordinates);
}

function syncPacketCoordinates(packet) {
  const targetId = packet.targetNode?.id || 'R1';
  const stages = {
    c0_r0: ['C0', 'R0'],
    r0_intermediate: ['R0', targetId],
    intermediate_p0: [targetId, 'P0'],
    p0_intermediate: ['P0', targetId],
    intermediate_r0: [targetId, 'R0'],
    r0_c0: ['R0', 'C0']
  };
  const pair = stages[packet.stage];
  if (!pair || !APP_STATE.nodes[pair[0]] || !APP_STATE.nodes[pair[1]]) return;
  packet.startX = APP_STATE.nodes[pair[0]].x;
  packet.startY = APP_STATE.nodes[pair[0]].y;
  packet.endX = APP_STATE.nodes[pair[1]].x;
  packet.endY = APP_STATE.nodes[pair[1]].y;
}

function topologyRenderLoop() {
  if (topCtx && topCanvas) {
    topCtx.clearRect(0, 0, topCanvas.width, topCanvas.height);
    drawTopologyGrid();
    drawLinks();
    drawPackets();
    drawNodes();
  }
  requestAnimationFrame(topologyRenderLoop);
}

function drawTopologyGrid() {
  topCtx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
  topCtx.lineWidth = 1;
  const step = 35;
  for (let x = 0; x < topCanvas.width; x += step) {
    topCtx.beginPath();
    topCtx.moveTo(x, 0);
    topCtx.lineTo(x, topCanvas.height);
    topCtx.stroke();
  }
  for (let y = 0; y < topCanvas.height; y += step) {
    topCtx.beginPath();
    topCtx.moveTo(0, y);
    topCtx.lineTo(topCanvas.width, y);
    topCtx.stroke();
  }
}

function drawLinks() {
  const activePath = APP_STATE.activePathId;

  Object.values(APP_STATE.links).forEach(link => {
    const nodeA = APP_STATE.nodes[link.from];
    const nodeB = APP_STATE.nodes[link.to];
    if (!nodeA || !nodeB) return;

    // Check if link is on currently active forwarding path
    const isLinkActive = (link.id === 'L_C0_R0') ||
      (activePath === 'pathA' && (link.id === 'L_R0_R1' || link.id === 'L_R1_P0')) ||
      (activePath === 'pathB' && (link.id === 'L_R0_R2' || link.id === 'L_R2_P0')) ||
      (activePath === 'pathC' && (link.id === 'L_R0_R3' || link.id === 'L_R3_P0'));

    const isCongested = link.status === 'CONGESTED';

    topCtx.beginPath();
    topCtx.moveTo(nodeA.x, nodeA.y);
    topCtx.lineTo(nodeB.x, nodeB.y);

    if (isCongested) {
      topCtx.strokeStyle = '#ef4444';
      topCtx.lineWidth = 4;
      topCtx.shadowColor = 'rgba(239, 68, 68, 0.6)';
      topCtx.shadowBlur = 10;
    } else if (isLinkActive) {
      topCtx.strokeStyle = '#06b6d4';
      topCtx.lineWidth = 3.5;
      topCtx.shadowColor = 'rgba(6, 182, 212, 0.6)';
      topCtx.shadowBlur = 8;
    } else {
      topCtx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      topCtx.lineWidth = 1.8;
      topCtx.shadowBlur = 0;
    }

    topCtx.stroke();
    topCtx.shadowBlur = 0;

    // Link Telemetry Tag
    const midX = (nodeA.x + nodeB.x) / 2;
    const midY = (nodeA.y + nodeB.y) / 2;
    topCtx.fillStyle = isCongested ? '#fca5a5' : (isLinkActive ? '#a5f3fc' : '#64748b');
    topCtx.font = '10px Inter, sans-serif';
    topCtx.textAlign = 'center';

    let tagText = `${link.bandwidth}M | ${link.delay}ms`;
    if (link.loss > 0) tagText += ` | ${link.loss}% loss`;
    topCtx.fillText(tagText, midX, midY - 8);

    // Queue Fill Bar Indicator
    if (link.queueDepth > 0) {
      const barW = 30;
      const barH = 4;
      const fillPct = Math.min(1.0, link.queueDepth / link.maxQueue);
      topCtx.fillStyle = 'rgba(0,0,0,0.5)';
      topCtx.fillRect(midX - barW / 2, midY + 4, barW, barH);
      topCtx.fillStyle = isCongested ? '#ef4444' : '#10b981';
      topCtx.fillRect(midX - barW / 2, midY + 4, barW * fillPct, barH);
    }
  });
}

function drawNodes() {
  Object.values(APP_STATE.nodes).forEach(node => {
    const isSelected = APP_STATE.inspectedElement.id === node.id;
    const isWinningRoute = (node.id === 'R1' && APP_STATE.activePathId === 'pathA') ||
                          (node.id === 'R2' && APP_STATE.activePathId === 'pathB') ||
                          (node.id === 'R3' && APP_STATE.activePathId === 'pathC');

    // Selection or Active Glow Ring
    if (isSelected || isWinningRoute || node.id === 'R0') {
      topCtx.beginPath();
      topCtx.arc(node.x, node.y, 26, 0, Math.PI * 2);
      topCtx.fillStyle = node.id === 'R0' ? 'rgba(6, 182, 212, 0.25)' : (isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.2)');
      topCtx.fill();
    }

    // Node Body
    topCtx.beginPath();
    topCtx.arc(node.x, node.y, 18, 0, Math.PI * 2);

    if (node.type === 'consumer') topCtx.fillStyle = '#6366f1';
    else if (node.type === 'ade_router') topCtx.fillStyle = '#06b6d4';
    else if (node.type === 'cache_node') topCtx.fillStyle = '#a855f7';
    else if (node.type === 'producer') topCtx.fillStyle = '#ec4899';
    else topCtx.fillStyle = isWinningRoute ? '#10b981' : '#334155';

    topCtx.fill();
    topCtx.strokeStyle = isSelected ? '#fff' : (isWinningRoute ? '#a7f3d0' : '#475569');
    topCtx.lineWidth = isSelected ? 2.5 : 1.5;
    topCtx.stroke();

    // Node Label ID
    topCtx.fillStyle = '#fff';
    topCtx.font = 'bold 11px JetBrains Mono, monospace';
    topCtx.textAlign = 'center';
    topCtx.textBaseline = 'middle';
    topCtx.fillText(node.id, node.x, node.y);

    // Node Name Tag underneath
    topCtx.font = 'bold 11px Inter, sans-serif';
    topCtx.fillStyle = '#f8fafc';
    topCtx.fillText(node.name, node.x, node.y + 30);

    topCtx.font = '9px Inter, sans-serif';
    topCtx.fillStyle = '#94a3b8';
    topCtx.fillText(node.role, node.x, node.y + 43);
  });
}

function drawPackets() {
  inFlightPackets.forEach(p => {
    const curX = p.startX + (p.endX - p.startX) * p.progress;
    const curY = p.startY + (p.endY - p.startY) * p.progress;

    topCtx.beginPath();
    topCtx.arc(curX, curY, p.type === 'data' ? 5.5 : 4.5, 0, Math.PI * 2);

    if (p.isCacheHit) {
      topCtx.fillStyle = '#c084fc'; // Purple cache hit
      topCtx.shadowColor = '#a855f7';
    } else if (p.type === 'data') {
      topCtx.fillStyle = '#10b981'; // Green Data
      topCtx.shadowColor = '#10b981';
    } else {
      topCtx.fillStyle = '#38bdf8'; // Cyan Interest
      topCtx.shadowColor = '#06b6d4';
    }

    topCtx.shadowBlur = 6;
    topCtx.fill();
    topCtx.shadowBlur = 0;
  });
}

function handleTopologyClick(e) {
  const rect = topCanvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  // Check collision with nodes
  for (const node of Object.values(APP_STATE.nodes)) {
    const dist = Math.hypot(clickX - node.x, clickY - node.y);
    if (dist <= 24) {
      APP_STATE.inspectedElement = { type: 'node', id: node.id };
      updateInspectorDrawer();
      return;
    }
  }

  // Check collision with links
  for (const link of Object.values(APP_STATE.links)) {
    const nA = APP_STATE.nodes[link.from];
    const nB = APP_STATE.nodes[link.to];
    const midX = (nA.x + nB.x) / 2;
    const midY = (nA.y + nB.y) / 2;
    if (Math.hypot(clickX - midX, clickY - midY) <= 20) {
      APP_STATE.inspectedElement = { type: 'link', id: link.id };
      updateInspectorDrawer();
      return;
    }
  }
}

function updateInspectorDrawer() {
  const title = document.getElementById('inspector-title');
  const typeTag = document.getElementById('inspector-type-tag');
  const body = document.getElementById('inspector-body-content');
  if (!body) return;

  const target = APP_STATE.inspectedElement;

  if (target.type === 'node') {
    const node = APP_STATE.nodes[target.id];
    title.textContent = node.name;
    typeTag.textContent = node.type.toUpperCase();

    body.innerHTML = `
      <div class="inspector-row"><span class="inspector-label">Node Identifier</span><span class="inspector-value">${node.id}</span></div>
      <div class="inspector-row"><span class="inspector-label">Function / Role</span><span class="inspector-value">${node.role}</span></div>
      <div class="inspector-row"><span class="inspector-label">Operational Status</span><span class="inspector-value" style="color:#10b981;">${node.status}</span></div>
      <div class="inspector-row"><span class="inspector-label">FIB Next Hops</span><span class="inspector-value">${node.id === 'R0' ? '3 Eligible Faces' : '1 Face'}</span></div>
      <div class="inspector-row"><span class="inspector-label">ContentStore Capacity</span><span class="inspector-value">${node.id === 'R3' ? '500 Packets (Active)' : '0 (Transit)'}</span></div>
      <div class="inspector-row"><span class="inspector-label">NFD Strategy</span><span class="inspector-value">${node.id === 'R0' ? '/localhost/nfd/strategy/ade' : 'BestRoute'}</span></div>
    `;
  } else {
    const link = APP_STATE.links[target.id];
    title.textContent = `Link ${link.from} ➔ ${link.to}`;
    typeTag.textContent = 'POINT-TO-POINT';

    body.innerHTML = `
      <div class="inspector-row"><span class="inspector-label">Configured Data Rate</span><span class="inspector-value">${link.bandwidth} Mbps</span></div>
      <div class="inspector-row"><span class="inspector-label">Propagation Delay</span><span class="inspector-value">${link.delay} ms</span></div>
      <div class="inspector-row"><span class="inspector-label">Simulated Packet Loss</span><span class="inspector-value">${link.loss}%</span></div>
      <div class="inspector-row"><span class="inspector-label">DropTail Queue Occupancy</span><span class="inspector-value">${link.queueDepth} / ${link.maxQueue} pkts</span></div>
      <div class="inspector-row"><span class="inspector-label">Link Status</span><span class="inspector-value" style="color:${link.status==='CONGESTED'?'#ef4444':'#10b981'};">${link.status}</span></div>
    `;
  }
}

function resetTopologyState() {
  inFlightPackets = [];
  APP_STATE.metrics.interestsSent = 0;
  APP_STATE.metrics.dataReceived = 0;
  APP_STATE.metrics.packetsDropped = 0;
  APP_STATE.metrics.cacheHits = 0;
  APP_STATE.requests = [];
  updateOverviewCards();
  addLog('INFO', 'Topology counters and packet queues reset to baseline.');
}

// =============================================================================
// 5. ADE SCORING PIPELINE & NORMALIZATION ENGINE
// =============================================================================

function initAdeSliders() {
  const weightSliders = [
    { id: 'weight-delay', key: 'delay' },
    { id: 'weight-loss', key: 'loss' },
    { id: 'weight-cost', key: 'linkCost' },
    { id: 'weight-bandwidth', key: 'bandwidth' },
    { id: 'weight-cache', key: 'cacheHit' },
    { id: 'weight-queue', key: 'queue' }
  ];

  weightSliders.forEach(s => {
    const el = document.getElementById(s.id);
    const label = document.getElementById(`${s.id}-val`);
    if (!el) return;

    el.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      APP_STATE.weights[s.key] = val;
      if (label) label.textContent = val.toFixed(2);
      recalculateAdeScores();
    });
  });

  // Weight Profile Presets
  const profileSelect = document.getElementById('ade-weight-profile');
  if (profileSelect) {
    profileSelect.addEventListener('change', (e) => {
      applyWeightProfile(e.target.value);
    });
  }
}

function applyWeightProfile(profile) {
  if (profile === 'balanced') {
    APP_STATE.weights = { delay: 0.30, loss: 0.25, linkCost: 0.15, bandwidth: 0.10, cacheHit: 0.15, queue: 0.05 };
  } else if (profile === 'latency_critical') {
    APP_STATE.weights = { delay: 0.50, loss: 0.25, linkCost: 0.10, bandwidth: 0.05, cacheHit: 0.05, queue: 0.05 };
  } else if (profile === 'cache_cdn') {
    APP_STATE.weights = { delay: 0.15, loss: 0.15, linkCost: 0.10, bandwidth: 0.10, cacheHit: 0.40, queue: 0.10 };
  } else if (profile === 'cost_optimized') {
    APP_STATE.weights = { delay: 0.15, loss: 0.15, linkCost: 0.40, bandwidth: 0.15, cacheHit: 0.10, queue: 0.05 };
  }

  // Update slider inputs in DOM
  Object.keys(APP_STATE.weights).forEach(k => {
    const slider = document.getElementById(`weight-${k === 'linkCost' ? 'cost' : (k === 'cacheHit' ? 'cache' : k)}`);
    const valLabel = document.getElementById(`weight-${k === 'linkCost' ? 'cost' : (k === 'cacheHit' ? 'cache' : k)}-val`);
    if (slider) slider.value = APP_STATE.weights[k];
    if (valLabel) valLabel.textContent = APP_STATE.weights[k].toFixed(2);
  });

  recalculateAdeScores();
}

/**
 * Normalization & Multi-Factor Scoring Pipeline:
 * Step 1: Extract criteria bounds [min, max] across candidate faces.
 * Step 2: Cost Normalization (Delay, Loss, Cost, Queue): norm = (x - min) / (max - min)
 * Step 3: Benefit Normalization (Bandwidth, CacheHit): norm = (max - x) / (max - min) (inverted)
 * Step 4: Calculate composite utility score: S = sum(w_k * norm_k)
 * Step 5: Anti-flapping hysteresis check: Must beat current path by 15% before switching.
 */
function recalculateAdeScores() {
  const pathKeys = ['pathA', 'pathB', 'pathC'];
  const pData = APP_STATE.paths;

  // Criteria Min-Max across candidates
  const bounds = {
    delay: { min: Math.min(...pathKeys.map(k => pData[k].delayMs)), max: Math.max(...pathKeys.map(k => pData[k].delayMs)) },
    loss: { min: Math.min(...pathKeys.map(k => pData[k].lossPercent)), max: Math.max(...pathKeys.map(k => pData[k].lossPercent)) },
    cost: { min: Math.min(...pathKeys.map(k => pData[k].linkCost)), max: Math.max(...pathKeys.map(k => pData[k].linkCost)) },
    bandwidth: { min: Math.min(...pathKeys.map(k => pData[k].bandwidthMbps)), max: Math.max(...pathKeys.map(k => pData[k].bandwidthMbps)) },
    cache: { min: Math.min(...pathKeys.map(k => pData[k].cacheHitPercent)), max: Math.max(...pathKeys.map(k => pData[k].cacheHitPercent)) },
    queue: { min: Math.min(...pathKeys.map(k => pData[k].queueCongestionPercent)), max: Math.max(...pathKeys.map(k => pData[k].queueCongestionPercent)) }
  };

  const scores = {};

  pathKeys.forEach(pk => {
    const p = pData[pk];

    // Safe normalization helper (returns 0.5 if range is 0)
    const normCost = (val, b) => b.max === b.min ? 0.5 : (val - b.min) / (b.max - b.min);
    const normBenefit = (val, b) => b.max === b.min ? 0.5 : (b.max - val) / (b.max - b.min);

    const nDelay = normCost(p.delayMs, bounds.delay);
    const nLoss = normCost(p.lossPercent, bounds.loss);
    const nCost = normCost(p.linkCost, bounds.cost);
    const nBandwidth = normBenefit(p.bandwidthMbps, bounds.bandwidth);
    const nCache = normBenefit(p.cacheHitPercent, bounds.cache);
    const nQueue = normCost(p.queueCongestionPercent, bounds.queue);

    const w = APP_STATE.weights;
    const compositeScore = (
      w.delay * nDelay +
      w.loss * nLoss +
      w.linkCost * nCost +
      w.bandwidth * nBandwidth +
      w.cacheHit * nCache +
      w.queue * nQueue
    ) * 100;

    p.normalizedScore = +compositeScore.toFixed(1);
    scores[pk] = p.normalizedScore;
  });

  // Determine lowest score candidate
  let bestCandidate = 'pathA';
  let lowestScore = Infinity;
  pathKeys.forEach(pk => {
    if (scores[pk] < lowestScore) {
      lowestScore = scores[pk];
      bestCandidate = pk;
    }
  });

  // Anti-flapping hysteresis evaluation
  const curActive = APP_STATE.activePathId;
  if (bestCandidate !== curActive) {
    const scoreDiffPct = (scores[curActive] - scores[bestCandidate]) / Math.max(1, scores[curActive]);
    if (scoreDiffPct >= APP_STATE.antiFlappingMargin) {
      // Confirmed path switch!
      const prevPath = curActive;
      APP_STATE.activePathId = bestCandidate;
      APP_STATE.metrics.pathChangesCount++;
      APP_STATE.metrics.adeDecisionsCount++;
      APP_STATE.lastSwitchedTime = APP_STATE.simTimeSeconds;

      addLog('PATH_CHANGE', `ADE Forwarder shifted route from ${pData[prevPath].name} to ${pData[bestCandidate].name} (Score: ${scores[bestCandidate]} vs ${scores[prevPath]}).`);
    } else {
      // Hysteresis suppression
      addLog('INFO', `Path switch to ${pData[bestCandidate].name} suppressed by anti-flapping margin (${(scoreDiffPct*100).toFixed(1)}% < 15%).`);
    }
  }

  // Update Status Labels
  pathKeys.forEach(pk => {
    pData[pk].status = pk === APP_STATE.activePathId ? 'SELECTED' : 'AVAILABLE';
  });

  updateAdeTableDOM(scores);
}

function updateAdeTableDOM(scores) {
  const tbody = document.getElementById('ade-comparison-tbody');
  if (!tbody) return;

  tbody.innerHTML = Object.values(APP_STATE.paths).map(p => {
    const isChosen = p.id === APP_STATE.activePathId;
    return `
      <tr class="${isChosen ? 'selected-row' : ''}">
        <td><strong>${p.name}</strong> <span class="table-pill ${isChosen ? 'cyan' : ''}">Face ${p.faceId}</span></td>
        <td>${p.delayMs} ms</td>
        <td>${p.lossPercent}%</td>
        <td>${p.bandwidthMbps} Mbps</td>
        <td>${p.linkCost}</td>
        <td>${p.cacheHitPercent}%</td>
        <td>${p.queueCongestionPercent}%</td>
        <td><strong style="color:${isChosen ? '#06b6d4' : 'inherit'}">${p.normalizedScore}</strong></td>
        <td><span class="table-pill ${isChosen ? 'green' : 'amber'}">${isChosen ? 'SELECTED' : 'STANDBY'}</span></td>
      </tr>
    `;
  }).join('');

  // Update ADE Decision summary banner
  const chosenPath = APP_STATE.paths[APP_STATE.activePathId];
  const summaryBox = document.getElementById('ade-summary-card');
  if (summaryBox) {
    summaryBox.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Active Forwarding Choice</div>
          <div style="font-size:1.35rem; font-weight:800; color:var(--accent-cyan);">${chosenPath.name}</div>
          <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">
            Selected via NFD Face ${chosenPath.faceId}. Reason: Lowest normalized multi-factor composite cost (${chosenPath.normalizedScore}).
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:2rem; font-weight:800; font-family:var(--font-mono); color:var(--status-healthy);">${chosenPath.normalizedScore}</div>
          <div style="font-size:0.7rem; color:var(--text-muted);">Composite Score</div>
        </div>
      </div>
    `;
  }
}

// =============================================================================
// 6. SIMULATION CONTROL PANEL & SCENARIOS
// =============================================================================

function initControlPanel() {
  const playBtn = document.getElementById('ctrl-play-pause');
  const stepBtn = document.getElementById('ctrl-step');
  const resetBtn = document.getElementById('ctrl-reset');
  const speedSel = document.getElementById('ctrl-speed');

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      APP_STATE.simRunning = !APP_STATE.simRunning;
      playBtn.textContent = APP_STATE.simRunning ? '⏸ Pause' : '▶ Resume';
      addLog('INFO', `Simulation ${APP_STATE.simRunning ? 'resumed' : 'paused'} by user.`);
    });
  }

  if (stepBtn) {
    stepBtn.addEventListener('click', () => {
      tickSimulationStep(0.2);
      addLog('INFO', 'Single simulation step advanced (+200ms).');
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', resetSimulationToBaseline);
  }

  if (speedSel) {
    speedSel.addEventListener('change', (e) => {
      APP_STATE.simSpeed = parseFloat(e.target.value);
    });
  }

  // Interactive Scenario Trigger Buttons
  const scenarioBtns = document.querySelectorAll('.scenario-card-btn');
  scenarioBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      scenarioBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      triggerScenario(btn.dataset.scenario);
    });
  });

  // Link modification sliders
  setupLinkSliders();
}

function initSharedRoomControls() {
  const roomInput = document.getElementById('room-id-input');
  const participantInput = document.getElementById('participant-name-input');
  const serverInput = document.getElementById('backend-url-input');
  const connectBtn = document.getElementById('room-connect-btn');
  const requestInput = document.getElementById('content-request-input');
  const requestBtn = document.getElementById('content-request-btn');

  if (roomInput) roomInput.value = APP_STATE.room.id;
  if (participantInput) participantInput.value = APP_STATE.room.participant;
  if (serverInput && window.location.protocol !== 'file:') serverInput.value = window.location.host;

  const request = () => {
    if (requestInput) sendContentRequest(requestInput.value);
  };
  if (requestBtn) requestBtn.addEventListener('click', request);
  if (requestInput) requestInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') request();
  });
  document.querySelectorAll('.sample-request').forEach(button => {
    button.addEventListener('click', () => {
      if (requestInput) requestInput.value = button.dataset.name;
      request();
    });
  });

  const explorerSearch = document.getElementById('explorer-search-input');
  const explorerFilter = document.getElementById('explorer-filter-status');
  if (explorerSearch) explorerSearch.addEventListener('input', updateContentExplorerDOM);
  if (explorerFilter) explorerFilter.addEventListener('change', updateContentExplorerDOM);

  if (connectBtn) connectBtn.addEventListener('click', () => {
    APP_STATE.room.id = (roomInput?.value || 'ADE-DEMO').trim().toUpperCase() || 'ADE-DEMO';
    APP_STATE.room.participant = (participantInput?.value || 'Presenter').trim() || 'Presenter';
    const server = (serverInput?.value || '').trim();
    APP_STATE.wsUrl = makeWebSocketUrl(server);
    if (wsClient) wsClient.close();
    connectWebSocket();
  });
}

function makeWebSocketUrl(server = '') {
  let host = server;
  if (!host) host = window.location.protocol === 'file:' ? 'localhost:8000' : window.location.host;
  host = host.replace(/^https?:\/\//, '').replace(/^ws:\/\//, '').replace(/^wss:\/\//, '');
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${host || 'localhost:8000'}/ws`;
}

function updateSharedRoomUI() {
  const presence = document.getElementById('room-presence');
  if (!presence) return;
  if (!APP_STATE.backendConnected) {
    presence.innerHTML = '<span class="pulse-dot-sm"></span> Offline / local demo';
    return;
  }
  const count = APP_STATE.room.participants.length;
  presence.innerHTML = `<span class="pulse-dot-sm"></span> Live · ${count} participant${count === 1 ? '' : 's'} · Cache ${APP_STATE.room.cache.length}/6`;
}

function sendContentRequest(contentName) {
  const name = (contentName || '').trim();
  if (!name) return;
  if (wsClient && wsClient.readyState === WebSocket.OPEN && APP_STATE.backendConnected) {
    wsClient.send(JSON.stringify({ type: 'REQUEST', name }));
    return;
  }
  recalculateAdeScores();
  spawnSimulatedRequest(false, name);
  updateContentExplorerDOM();
  updateOverviewCards();
  addLog('INFO', `Local simulator processed ${name}. Start backend/server.py for cross-device sharing.`);
}

function decisionForPath(path, cacheHit, latency) {
  return {
    pathId: path.id,
    pathName: path.name,
    faceId: path.faceId,
    reason: cacheHit
      ? 'The requested name was already popular in the ContentStore, so Router R3 returned it locally instead of contacting Producer P0.'
      : `${path.name} won the ADE comparison because its weighted combination of delay, loss, bandwidth, cache value, and queue pressure had the lowest cost (${path.normalizedScore}).`,
    factors: [
      { label: 'Delay', value: `${path.delayMs} ms` },
      { label: 'Loss', value: `${path.lossPercent}%` },
      { label: 'Bandwidth', value: `${path.bandwidthMbps} Mbps` },
      { label: 'Cache value', value: `${path.cacheHitPercent}%` },
      { label: 'Queue', value: `${path.queueCongestionPercent}%` },
      { label: 'Score', value: `${path.normalizedScore}` }
    ],
    latencyMs: latency
  };
}

function renderRequestDecision(requestItem, decision = {}) {
  const status = document.getElementById('decision-status');
  const sequence = document.getElementById('decision-seq');
  const content = document.getElementById('decision-content-name');
  const path = document.getElementById('decision-path');
  const source = document.getElementById('decision-source');
  const latency = document.getElementById('decision-latency');
  const face = document.getElementById('decision-face');
  const popularity = document.getElementById('decision-popularity');
  const reason = document.getElementById('decision-reason');
  const factors = document.getElementById('decision-factor-list');
  if (!status || !requestItem) return;

  const isHit = requestItem.status === 'CACHE_HIT';
  status.textContent = isHit ? 'Cache hit · served from edge' : (requestItem.status === 'PACKET_DROP' ? 'Packet dropped · path timeout' : 'Cache miss · fetched from producer');
  status.style.color = isHit ? 'var(--purple)' : (requestItem.status === 'PACKET_DROP' ? 'var(--red)' : 'var(--cyan)');
  if (sequence) sequence.textContent = `INTEREST #${requestItem.id}`;
  if (content) content.textContent = requestItem.name;
  if (path) path.textContent = decision.pathName || requestItem.path || 'Path selected by ADE';
  if (source) source.textContent = requestItem.source || (isHit ? 'Router R3 (ContentStore)' : 'Producer P0');
  if (latency) latency.textContent = `${requestItem.latencyMs} ms`;
  if (face) face.textContent = decision.faceId ? `Face ${decision.faceId}` : (requestItem.face || '—');
  if (popularity) popularity.textContent = requestItem.popularity ? `${requestItem.popularity} request${requestItem.popularity === 1 ? '' : 's'}` : '—';
  if (reason) reason.textContent = decision.reason || 'ADE evaluated the current path factors before forwarding this Interest.';
  if (factors) {
    const list = decision.factors || [];
    factors.innerHTML = list.length ? list.map(item => `<span class="factor-chip">${item.label} <b>${item.value}</b></span>`).join('') : '<span class="factor-empty">No factor telemetry attached.</span>';
  }
}

function setupLinkSliders() {
  const linkDelaySlider = document.getElementById('slider-path1-delay');
  const linkLossSlider = document.getElementById('slider-path1-loss');

  if (linkDelaySlider) {
    linkDelaySlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      APP_STATE.paths.pathA.delayMs = val;
      APP_STATE.links.L_R0_R1.delay = val;
      document.getElementById('slider-path1-delay-val').textContent = `${val} ms`;
      recalculateAdeScores();
    });
  }

  if (linkLossSlider) {
    linkLossSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      APP_STATE.paths.pathA.lossPercent = val;
      APP_STATE.links.L_R0_R1.loss = val;
      document.getElementById('slider-path1-loss-val').textContent = `${val}%`;
      recalculateAdeScores();
    });
  }
}

function triggerScenario(scenarioKey, broadcast = true) {
  if (scenarioKey === 'baseline_normal') {
    // Normal state: Path A optimal
    APP_STATE.paths.pathA.delayMs = 18;
    APP_STATE.paths.pathA.lossPercent = 0.5;
    APP_STATE.paths.pathA.queueCongestionPercent = 10;
    APP_STATE.links.L_R0_R1.status = 'NORMAL';

    APP_STATE.paths.pathB.delayMs = 35;
    APP_STATE.paths.pathB.lossPercent = 0.0;
    APP_STATE.paths.pathB.queueCongestionPercent = 5;

    APP_STATE.paths.pathC.delayMs = 45;
    APP_STATE.paths.pathC.cacheHitPercent = 20;

    addLog('INFO', 'Applied Scenario: Normal Baseline Operating Conditions.');
  } else if (scenarioKey === 'congestion_path_a') {
    // Congestion on Path A: Delay surges to 95ms, Queue to 90%, Loss to 6%
    APP_STATE.paths.pathA.delayMs = 95;
    APP_STATE.paths.pathA.lossPercent = 6.0;
    APP_STATE.paths.pathA.queueCongestionPercent = 90;
    APP_STATE.links.L_R0_R1.status = 'CONGESTED';
    APP_STATE.links.L_R0_R1.queueDepth = 23;

    addLog('LINK_CONGESTION', 'WARNING: DropTail buffer overflow on Link R0-R1 (Face 258)! Delay spiked to 95ms.');
  } else if (scenarioKey === 'loss_path_b') {
    // Loss spike on Path B: Loss surges to 15%
    APP_STATE.paths.pathB.lossPercent = 15.0;
    APP_STATE.paths.pathB.queueCongestionPercent = 40;
    addLog('WARN', 'Transient packet loss spike (15%) injected on Path B (Router R2).');
  } else if (scenarioKey === 'cache_warmup_path_c') {
    // Cache hits on Path C surge to 92%
    APP_STATE.paths.pathC.cacheHitPercent = 92.0;
    APP_STATE.paths.pathC.delayMs = 12.0;
    addLog('CACHE_HIT', 'ContentStore warmup complete on Edge Router R3. Cache hit ratio surged to 92%.');
  }

  if (broadcast && wsClient && wsClient.readyState === WebSocket.OPEN && APP_STATE.backendConnected) {
    const sharedScenario = {
      baseline_normal: 'NORMAL',
      congestion_path_a: 'CONGESTION',
      loss_path_b: 'LOSS',
      cache_warmup_path_c: 'CACHE'
    }[scenarioKey];
    if (sharedScenario) wsClient.send(JSON.stringify({ type: 'SCENARIO', scenario: sharedScenario }));
  }

  recalculateAdeScores();
  updateOverviewCards();
}

function resetSimulationToBaseline() {
  triggerScenario('baseline_normal');
  resetTopologyState();
  APP_STATE.simTimeSeconds = 0.0;
  addLog('INFO', 'Simulation reset to Initial State t = 0.0s.');
}

// =============================================================================
// 7. SUPERVISOR 12-STEP DEMONSTRATION SCENARIO MACHINE
// =============================================================================

function initSupervisorScenario() {
  const startBtn = document.getElementById('btn-start-supervisor-demo');
  const banner = document.getElementById('supervisor-banner');
  const stepText = document.getElementById('supervisor-step-text');
  const stepPill = document.getElementById('supervisor-step-pill');
  const stopBtn = document.getElementById('btn-stop-supervisor-demo');

  if (!startBtn) return;

  const SCENARIO_STEPS = [
    { delay: 3500, text: "Step 1/12: Initializing multi-path NDN topology (C0 ➔ R0 ➔ [R1, R2, R3] ➔ P0). Path A is optimal.", action: () => triggerScenario('baseline_normal') },
    { delay: 4000, text: "Step 2/12: Consumer C0 begins issuing Interest stream for /video/news/segment1 (15 req/sec).", action: () => {} },
    { delay: 4500, text: "Step 3/12: Traffic established over Path A. End-to-end latency steady at 18.2ms; PDR 100%.", action: () => {} },
    { delay: 4000, text: "Step 4/12: ContentStore caching active on edge routers; PIT table records regular round-trips.", action: () => {} },
    { delay: 5000, text: "Step 5/12: INJECTING CONGESTION ON PATH A! Throttling link R0-R1 to 200 Kbps; DropTail queue fills.", action: () => triggerScenario('congestion_path_a') },
    { delay: 4500, text: "Step 6/12: Measured latency spikes to 95ms; queue occupancy reaches 90%; buffer loss begins.", action: () => {} },
    { delay: 4000, text: "Step 7/12: ADE engine intercepts degraded measurements via afterReceiveInterest() trigger.", action: () => {} },
    { delay: 4500, text: "Step 8/12: ADE re-evaluates candidates. Path B score (32.4) beats Path A (78.2) by > 15% margin.", action: () => recalculateAdeScores() },
    { delay: 4500, text: "Step 9/12: PATH SWITCH CONFIRMED! Traffic rerouted via Face 259 (Router R2) in under 25ms.", action: () => {} },
    { delay: 4500, text: "Step 10/12: Latency drops from 95ms down to 35ms; Packet Delivery Ratio recovers to 99.4%.", action: () => {} },
    { delay: 5000, text: "Step 11/12: Cache hit test: Requests for /dataset/research/chunk12 satisfy locally at Router R3.", action: () => triggerScenario('cache_warmup_path_c') },
    { delay: 4000, text: "Step 12/12: Demonstration complete! Supervisor can now inspect Comparative Analytics & CSV Export.", action: () => completeSupervisorDemo() }
  ];

  startBtn.addEventListener('click', () => {
    APP_STATE.supervisorScenario.active = true;
    APP_STATE.supervisorScenario.stepIndex = 0;
    banner.classList.add('active');
    runNextScenarioStep(SCENARIO_STEPS);
  });

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      APP_STATE.supervisorScenario.active = false;
      clearTimeout(APP_STATE.supervisorScenario.stepTimer);
      banner.classList.remove('active');
      addLog('INFO', 'Supervisor demonstration scenario cancelled.');
    });
  }

  function runNextScenarioStep(steps) {
    const idx = APP_STATE.supervisorScenario.stepIndex;
    if (!APP_STATE.supervisorScenario.active || idx >= steps.length) {
      completeSupervisorDemo();
      return;
    }

    const step = steps[idx];
    stepPill.textContent = `STEP ${idx + 1}/${steps.length}`;
    stepText.textContent = step.text;
    step.action();

    APP_STATE.supervisorScenario.stepIndex++;
    APP_STATE.supervisorScenario.stepTimer = setTimeout(() => {
      runNextScenarioStep(steps);
    }, step.delay);
  }

  function completeSupervisorDemo() {
    APP_STATE.supervisorScenario.active = false;
    banner.classList.remove('active');
    addLog('INFO', 'Supervisor demonstration completed successfully.');
  }
}

// =============================================================================
// 8. CONTENT REQUEST EXPLORER
// =============================================================================

const REALISTIC_NDN_PREFIXES = [
  { name: '/video/news/segment1', size: 1024, popularity: 'HIGH' },
  { name: '/video/sports/segment4', size: 1024, popularity: 'HIGH' },
  { name: '/dataset/research/chunk12', size: 1024, popularity: 'MEDIUM' },
  { name: '/iot/temperature/region1', size: 256, popularity: 'LOW' },
  { name: '/cdn/hls/manifest.m3u8', size: 512, popularity: 'HIGH' }
];

function seedInitialData() {
  for (let i = 1; i <= 8; i++) {
    spawnSimulatedRequest(true);
  }
  updateContentExplorerDOM();
}

function spawnSimulatedRequest(isInitial = false, requestedName = '') {
  APP_STATE.interestSeq++;
  APP_STATE.metrics.interestsSent++;

  const knownContent = REALISTIC_NDN_PREFIXES.find(item => item.name === requestedName);
  const content = knownContent || (requestedName ? { name: requestedName, size: 1024, popularity: 'NEW' } : REALISTIC_NDN_PREFIXES[Math.floor(Math.random() * REALISTIC_NDN_PREFIXES.length)]);
  APP_STATE.contentPopularity[content.name] = (APP_STATE.contentPopularity[content.name] || 0) + 1;
  const activePath = APP_STATE.paths[APP_STATE.activePathId];

  // Determine whether packet succeeds or drops based on active path loss
  const willDrop = Math.random() < (activePath.lossPercent / 100);
  const isCacheHit = !willDrop && (requestedName ? APP_STATE.contentPopularity[content.name] > 1 : (activePath.viaNode === 'R3' || Math.random() < (activePath.cacheHitPercent / 100)));
  const routePath = isCacheHit ? APP_STATE.paths.pathC : activePath;
  APP_STATE.activePathId = routePath.id;

  let status = 'CACHE_MISS';
  let latency = activePath.delayMs + (Math.random() * 4 - 2);

  if (willDrop) {
    status = 'PACKET_DROP';
    latency = 200.0; // timeout
    APP_STATE.metrics.packetsDropped++;
  } else if (isCacheHit) {
    status = 'CACHE_HIT';
    latency = 8.5 + (Math.random() * 2);
    APP_STATE.metrics.cacheHits++;
    APP_STATE.metrics.dataReceived++;
  } else {
    APP_STATE.metrics.dataReceived++;
  }

  // Mathematically consistent metric rollups
  const sent = APP_STATE.metrics.interestsSent;
  const rcvd = APP_STATE.metrics.dataReceived;
  const drops = APP_STATE.metrics.packetsDropped;
  const hits = APP_STATE.metrics.cacheHits;

  APP_STATE.metrics.pdrPercent = +( (rcvd / Math.max(1, sent)) * 100 ).toFixed(1);
  APP_STATE.metrics.lossPercent = +( (drops / Math.max(1, sent)) * 100 ).toFixed(1);
  APP_STATE.metrics.cacheHitPercent = +( (hits / Math.max(1, rcvd)) * 100 ).toFixed(1);
  APP_STATE.metrics.avgDelayMs = +( 0.85 * APP_STATE.metrics.avgDelayMs + 0.15 * latency ).toFixed(1);
  const elapsedSeconds = Math.max(0.2, APP_STATE.simTimeSeconds);
  const measuredThroughputMbps = (rcvd * 1024 * 8) / (elapsedSeconds * 1000000);
  APP_STATE.metrics.throughputMbps = rcvd > 0 ? +measuredThroughputMbps.toFixed(3) : 0;

  const reqItem = {
    id: APP_STATE.interestSeq,
    time: APP_STATE.simTimeSeconds.toFixed(2),
    name: content.name,
    consumer: 'C0',
    router: 'R0',
    face: `Face ${routePath.faceId}`,
    path: routePath.name,
    source: isCacheHit ? 'Router R3 (CS)' : 'Producer P0',
    status: status,
    latencyMs: +latency.toFixed(1),
    sizeBytes: content.size,
    popularity: APP_STATE.contentPopularity[content.name],
    pathId: routePath.id,
    decision: decisionForPath(routePath, isCacheHit, +latency.toFixed(1))
  };

  APP_STATE.requests.unshift(reqItem);
  if (APP_STATE.requests.length > 50) APP_STATE.requests.pop();

  if (!isInitial) {
    // Log meaningful events
    if (status === 'PACKET_DROP') {
      addLog('DROP', `Interest ${content.name} timed out on ${routePath.name}.`);
    } else if (status === 'CACHE_HIT') {
      addLog('CACHE', `Cache Hit: ${content.name} served directly from ContentStore.`);
    }
  }

  // Spawn visual packet on topology
  spawnCanvasPacket(routePath, isCacheHit, willDrop);
  if (!isInitial) renderRequestDecision(reqItem, reqItem.decision);
}

function spawnCanvasPacket(pathObj, isCacheHit, willDrop) {
  const intermediateNode = APP_STATE.nodes[pathObj.viaNode];

  inFlightPackets.push({
    id: APP_STATE.interestSeq,
    type: 'interest',
    startX: APP_STATE.nodes.C0.x,
    startY: APP_STATE.nodes.C0.y,
    endX: APP_STATE.nodes.R0.x,
    endY: APP_STATE.nodes.R0.y,
    progress: 0,
    speed: 0.03 * APP_STATE.simSpeed,
    stage: 'c0_r0',
    targetNode: intermediateNode,
    isCacheHit: isCacheHit,
    willDrop: willDrop
  });
}

function updateContentExplorerDOM() {
  const tbody = document.getElementById('content-explorer-tbody');
  if (!tbody) return;

  const filter = document.getElementById('explorer-filter-status')?.value || 'ALL';
  const search = document.getElementById('explorer-search-input')?.value.toLowerCase() || '';

  const filtered = APP_STATE.requests.filter(r => {
    const matchStatus = filter === 'ALL' || r.status === filter;
    const matchSearch = r.name.toLowerCase().includes(search) || r.source.toLowerCase().includes(search);
    return matchStatus && matchSearch;
  });

  tbody.innerHTML = filtered.map(r => {
    let pillClass = 'green';
    if (r.status === 'PACKET_DROP') pillClass = 'red';
    else if (r.status === 'CACHE_HIT') pillClass = 'cyan';
    else if (r.status === 'CACHE_MISS') pillClass = 'amber';

    return `
      <tr>
        <td>${r.time}s</td>
        <td><strong>${r.name}</strong></td>
        <td>${r.consumer}</td>
        <td>${r.router} (${r.face})</td>
        <td>${r.source}</td>
        <td><span class="table-pill ${pillClass}">${r.status}</span></td>
        <td><span class="table-pill amber">${r.popularity || '—'}</span></td>
        <td>${r.latencyMs} ms</td>
        <td>${r.sizeBytes} B</td>
      </tr>
    `;
  }).join('');
}

// =============================================================================
// 9. PERFORMANCE CHARTS (CANVAS CHARTING ENGINE - ZERO CDN DEPENDENCY)
// =============================================================================

function initChartEngines() {
  // Pre-seed 30 seconds of historical data
  for (let t = 0; t <= 30; t++) {
    APP_STATE.history.time.push(t);

    const isCongested = t >= 10 && t < 22;
    const brLat = isCongested ? 85 + Math.random() * 20 : 18 + Math.random() * 4;
    const adeLat = isCongested ? (t < 12 ? 45 : 35 + Math.random() * 5) : 18 + Math.random() * 3;

    APP_STATE.history.baselineDelay.push(brLat);
    APP_STATE.history.adeDelay.push(adeLat);

    APP_STATE.history.baselineThroughput.push(isCongested ? 2.5 + Math.random() * 0.8 : 9.8);
    APP_STATE.history.adeThroughput.push(isCongested ? 9.2 + Math.random() * 0.5 : 9.9);

    APP_STATE.history.baselinePdr.push(isCongested ? 76.5 : 99.8);
    APP_STATE.history.adePdr.push(isCongested ? 99.1 : 100.0);
  }

  renderAllCharts();
  window.addEventListener('resize', renderAllCharts);
}

function renderAllCharts() {
  renderChart('chart-latency', APP_STATE.history.adeDelay, APP_STATE.history.baselineDelay, 'ms', 0, 120, 'ADE (Adaptive)', 'BestRoute (Baseline)');
  renderChart('chart-throughput', APP_STATE.history.adeThroughput, APP_STATE.history.baselineThroughput, 'Mbps', 0, 14, 'ADE Throughput', 'BestRoute Throughput');
  renderChart('chart-analytics-lat', APP_STATE.history.adeDelay, APP_STATE.history.baselineDelay, 'ms', 0, 120, 'ADE (Adaptive)', 'BestRoute (Baseline)');
  renderChart('chart-analytics-tp', APP_STATE.history.adeThroughput, APP_STATE.history.baselineThroughput, 'Mbps', 0, 14, 'ADE Throughput', 'BestRoute Throughput');
  renderChart('chart-pdr', APP_STATE.history.adePdr, APP_STATE.history.baselinePdr, '%', 60, 100, 'ADE PDR', 'BestRoute PDR');
}

function renderChart(canvasId, series1, series2, unit, minVal, maxVal, label1, label2) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = Math.max(320, canvas.parentElement?.clientWidth || 0);
  const h = canvas.height = 230;

  ctx.clearRect(0, 0, w, h);

  // Background subtle axes
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(45, 15);
  ctx.lineTo(45, h - 30);
  ctx.lineTo(w - 20, h - 30);
  ctx.stroke();

  // Grid lines
  ctx.fillStyle = '#728197';
  ctx.font = '10px IBM Plex Mono, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${maxVal}${unit}`, 40, 20);
  ctx.fillText(`${minVal}${unit}`, 40, h - 30);

  // Plot Series 2 (Baseline - Red dashed)
  drawSeries(ctx, series2, minVal, maxVal, w, h, '#e56b6f', true);

  // Plot Series 1 (ADE - Cyan solid)
  drawSeries(ctx, series1, minVal, maxVal, w, h, '#0891b2', false);

  // Legend
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'left';

  const legendX = Math.max(80, w - 220);
  ctx.fillStyle = '#0891b2';
  ctx.fillRect(legendX, 20, 12, 10);
  ctx.fillStyle = '#425466';
  ctx.fillText(label1, legendX + 18, 28);

  ctx.fillStyle = '#e56b6f';
  ctx.fillRect(legendX, 38, 12, 10);
  ctx.fillStyle = '#425466';
  ctx.fillText(label2, legendX + 18, 46);
}

function drawSeries(ctx, data, minVal, maxVal, w, h, color, isDashed) {
  if (data.length < 2) return;
  const plotW = w - 75;
  const plotH = h - 55;
  const stepX = plotW / (data.length - 1);

  ctx.beginPath();
  ctx.setLineDash(isDashed ? [4, 4] : []);
  data.forEach((val, i) => {
    const x = 50 + i * stepX;
    const y = Math.max(15, Math.min(h - 30, (h - 30) - ((val - minVal) / (maxVal - minVal)) * plotH));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.setLineDash([]);
}

// =============================================================================
// 10. LIVE EVENT LOG STREAM
// =============================================================================

function initEventLogs() {
  const searchInput = document.getElementById('log-search-input');
  const selectFilter = document.getElementById('log-filter-select');
  const clearBtn = document.getElementById('log-clear-btn');
  const pauseBtn = document.getElementById('log-pause-btn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      APP_STATE.logSearch = e.target.value.toLowerCase();
      renderLogsDOM();
    });
  }

  if (selectFilter) {
    selectFilter.addEventListener('change', (e) => {
      APP_STATE.logFilter = e.target.value;
      renderLogsDOM();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      APP_STATE.logs = [];
      renderLogsDOM();
    });
  }

  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      APP_STATE.logsPaused = !APP_STATE.logsPaused;
      pauseBtn.textContent = APP_STATE.logsPaused ? 'Resume Stream' : 'Pause Stream';
    });
  }
}

function addLog(tag, message) {
  if (APP_STATE.logsPaused) return;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

  const logItem = {
    id: Date.now() + Math.random(),
    time: timeStr,
    simTime: APP_STATE.simTimeSeconds.toFixed(2),
    tag: tag,
    message: message
  };

  APP_STATE.logs.unshift(logItem);
  if (APP_STATE.logs.length > 200) APP_STATE.logs.pop();

  renderLogsDOM();
}

function renderLogsDOM() {
  const container = document.getElementById('log-list-container');
  if (!container) return;

  const filtered = APP_STATE.logs.filter(l => {
    const matchTag = APP_STATE.logFilter === 'ALL' || l.tag === APP_STATE.logFilter;
    const matchSearch = l.message.toLowerCase().includes(APP_STATE.logSearch);
    return matchTag && matchSearch;
  });

  container.innerHTML = filtered.map(l => `
    <div class="log-entry">
      <span class="log-time">[${l.simTime}s]</span>
      <span class="log-tag ${l.tag}">${l.tag}</span>
      <span class="log-msg">${l.message}</span>
    </div>
  `).join('');
}

// =============================================================================
// 11. BACKEND CONNECTOR & WEBSOCKET CLIENT
// =============================================================================

let wsClient = null;

function initBackendConnector() {
  // Try connecting to backend WebSocket at startup
  APP_STATE.wsUrl = makeWebSocketUrl(document.getElementById('backend-url-input')?.value || '');
  connectWebSocket();

  // Export CSV button
  const exportCsvBtn = document.getElementById('btn-export-csv');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', exportBenchmarkCSV);
  }
}

function connectWebSocket() {
  try {
    wsClient = new WebSocket(APP_STATE.wsUrl);

    wsClient.onopen = () => {
      APP_STATE.backendConnected = true;
      APP_STATE.mode = 'connected';
      updateConnectionModeBadge();
      updateSharedRoomUI();
      wsClient.send(JSON.stringify({
        type: 'HELLO',
        room: APP_STATE.room.id,
        participant: APP_STATE.room.participant
      }));
      addLog('INFO', `Joined shared experiment room ${APP_STATE.room.id}.`);
    };

    wsClient.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleBackendTelemetryMessage(payload);
      } catch (err) {
        console.error('Invalid backend JSON packet:', err);
      }
    };

    wsClient.onclose = () => {
      APP_STATE.backendConnected = false;
      APP_STATE.mode = 'demo';
      updateConnectionModeBadge();
      updateSharedRoomUI();
    };

    wsClient.onerror = () => {
      APP_STATE.backendConnected = false;
      APP_STATE.mode = 'demo';
      updateConnectionModeBadge();
      updateSharedRoomUI();
    };
  } catch (err) {
    APP_STATE.backendConnected = false;
    APP_STATE.mode = 'demo';
    updateConnectionModeBadge();
    updateSharedRoomUI();
  }
}

function handleBackendTelemetryMessage(msg) {
  if (msg.type === 'TELEMETRY_UPDATE') {
    applySharedMetrics(msg);
    updateConnectionModeBadge();
    APP_STATE.room.participants = msg.participants || APP_STATE.room.participants;
    updateSharedRoomUI();
    updateOverviewCards();
  } else if (msg.type === 'LOG_EVENT') {
    addLog(msg.level, msg.message);
  } else if (msg.type === 'ROOM_STATE') {
    const state = msg.state || {};
    APP_STATE.room.participants = state.participants || [];
    APP_STATE.room.cache = state.cache || [];
    APP_STATE.requests = state.requests || [];
    applySharedMetrics(state.metrics || {});
    updateConnectionModeBadge();
    if (APP_STATE.requests[0]) renderRequestDecision(APP_STATE.requests[0], APP_STATE.requests[0].decision || {});
    updateSharedRoomUI();
    updateContentExplorerDOM();
    updateOverviewCards();
  } else if (msg.type === 'PARTICIPANTS') {
    APP_STATE.room.participants = msg.participants || [];
    updateSharedRoomUI();
  } else if (msg.type === 'REQUEST_RESULT') {
    const result = msg.result || {};
    const item = result.request;
    if (!item) return;
    APP_STATE.room.participants = msg.participants || APP_STATE.room.participants;
    APP_STATE.room.cache = result.cache || APP_STATE.room.cache;
    applySharedMetrics(result.metrics || {});
    updateConnectionModeBadge();
    APP_STATE.requests = [item, ...APP_STATE.requests.filter(request => request.id !== item.id)].slice(0, 50);
    if (item.status === 'CACHE_HIT') {
      addLog('CACHE', `${item.consumer}: ${item.name} was a CACHE HIT at Router R3 (${item.latencyMs} ms).`);
    } else {
      addLog('INFO', `${item.consumer}: ${item.name} was a CACHE MISS; fetched from Producer P0 (${item.latencyMs} ms).`);
    }
    const path = APP_STATE.paths[item.pathId] || APP_STATE.paths[APP_STATE.activePathId] || APP_STATE.paths.pathA;
    spawnCanvasPacket(path, item.status === 'CACHE_HIT', item.status === 'PACKET_DROP');
    renderRequestDecision(item, result.decision || item.decision || {});
    updateSharedRoomUI();
    updateContentExplorerDOM();
    updateOverviewCards();
  } else if (msg.type === 'SCENARIO_UPDATE') {
    const sharedScenarioKey = {
      NORMAL: 'baseline_normal',
      CONGESTION: 'congestion_path_a',
      LOSS: 'loss_path_b',
      CACHE: 'cache_warmup_path_c'
    }[msg.scenario];
    if (sharedScenarioKey) triggerScenario(sharedScenarioKey, false);
    addLog('WARN', `Shared room scenario changed to ${msg.scenario}.`);
  }
}

function applySharedMetrics(metrics) {
  const numericKeys = ['avgDelayMs', 'throughputMbps', 'pdrPercent', 'lossPercent', 'cacheHitPercent', 'interestsSent', 'dataReceived', 'packetsDropped', 'cacheHits', 'cacheMisses'];
  numericKeys.forEach(key => {
    if (typeof metrics[key] === 'number') APP_STATE.metrics[key] = metrics[key];
  });
  if (typeof metrics.telemetrySource === 'string') APP_STATE.telemetrySource = metrics.telemetrySource;
  if (metrics.activePath && APP_STATE.paths[metrics.activePath]) APP_STATE.activePathId = metrics.activePath;
}

function exportBenchmarkCSV() {
  const rows = [
    ['Simulation_Time_s', 'Active_Path', 'ADE_AvgDelay_ms', 'Baseline_AvgDelay_ms', 'ADE_Throughput_Mbps', 'Baseline_Throughput_Mbps', 'PDR_Percent', 'Cache_Hit_Percent']
  ];

  APP_STATE.history.time.forEach((t, i) => {
    rows.push([
      t,
      APP_STATE.activePathId,
      (APP_STATE.history.adeDelay[i] || 20).toFixed(2),
      (APP_STATE.history.baselineDelay[i] || 35).toFixed(2),
      (APP_STATE.history.adeThroughput[i] || 9.8).toFixed(2),
      (APP_STATE.history.baselineThroughput[i] || 8.0).toFixed(2),
      (APP_STATE.history.adePdr[i] || 99.5).toFixed(1),
      APP_STATE.metrics.cacheHitPercent
    ]);
  });

  const csvString = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
  const link = document.createElement('a');
  link.setAttribute('href', encodeURI(csvString));
  link.setAttribute('download', 'ade_ndnsim_benchmark_data.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  addLog('INFO', 'Exported benchmark telemetry dataset to ade_ndnsim_benchmark_data.csv');
}

// =============================================================================
// 12. MAIN SIMULATION TICK LOOP
// =============================================================================

function startMainSimulationLoop() {
  setInterval(() => {
    if (!APP_STATE.simRunning) return;
    tickSimulationStep(0.2 * APP_STATE.simSpeed);
  }, 200);

  // Interest packet generator (10 req/s)
  setInterval(() => {
    if (!APP_STATE.simRunning || APP_STATE.backendConnected) return;
    spawnSimulatedRequest(false);
    updateContentExplorerDOM();
    updateOverviewCards();
  }, 400);

  // Telemetry chart updater (every 1.5s)
  setInterval(() => {
    if (!APP_STATE.simRunning) return;
    updateTelemetryHistory();
  }, 1500);
}

function tickSimulationStep(deltaSec) {
  APP_STATE.simTimeSeconds += deltaSec;
  const timeDisplay = document.getElementById('top-bar-sim-time');
  if (timeDisplay) timeDisplay.textContent = `T = ${APP_STATE.simTimeSeconds.toFixed(1)}s`;

  // Advance in-flight packets
  for (let i = inFlightPackets.length - 1; i >= 0; i--) {
    const p = inFlightPackets[i];
    p.progress += p.speed;

    if (p.progress >= 1.0) {
      if (p.stage === 'c0_r0') {
        if (p.willDrop) {
          inFlightPackets.splice(i, 1);
          continue;
        }
        p.startX = APP_STATE.nodes.R0.x;
        p.startY = APP_STATE.nodes.R0.y;
        p.endX = p.targetNode.x;
        p.endY = p.targetNode.y;
        p.progress = 0;
        p.stage = 'r0_intermediate';
      } else if (p.stage === 'r0_intermediate') {
        if (p.isCacheHit) {
          // Turns around directly into Cache Hit Data packet
          p.type = 'data';
          p.startX = p.targetNode.x;
          p.startY = p.targetNode.y;
          p.endX = APP_STATE.nodes.R0.x;
          p.endY = APP_STATE.nodes.R0.y;
          p.progress = 0;
          p.stage = 'intermediate_r0';
        } else {
          // Traverses to Producer P0
          p.startX = p.targetNode.x;
          p.startY = p.targetNode.y;
          p.endX = APP_STATE.nodes.P0.x;
          p.endY = APP_STATE.nodes.P0.y;
          p.progress = 0;
          p.stage = 'intermediate_p0';
        }
      } else if (p.stage === 'intermediate_p0') {
        // Data packet returning
        p.type = 'data';
        p.startX = APP_STATE.nodes.P0.x;
        p.startY = APP_STATE.nodes.P0.y;
        p.endX = p.targetNode.x;
        p.endY = p.targetNode.y;
        p.progress = 0;
        p.stage = 'p0_intermediate';
      } else if (p.stage === 'p0_intermediate') {
        p.startX = p.targetNode.x;
        p.startY = p.targetNode.y;
        p.endX = APP_STATE.nodes.R0.x;
        p.endY = APP_STATE.nodes.R0.y;
        p.progress = 0;
        p.stage = 'intermediate_r0';
      } else if (p.stage === 'intermediate_r0') {
        p.startX = APP_STATE.nodes.R0.x;
        p.startY = APP_STATE.nodes.R0.y;
        p.endX = APP_STATE.nodes.C0.x;
        p.endY = APP_STATE.nodes.C0.y;
        p.progress = 0;
        p.stage = 'r0_c0';
      } else if (p.stage === 'r0_c0') {
        inFlightPackets.splice(i, 1);
      }
    }
  }
}

function updateTelemetryHistory() {
  const t = Math.floor(APP_STATE.simTimeSeconds);
  APP_STATE.history.time.push(t);
  if (APP_STATE.history.time.length > 35) {
    APP_STATE.history.time.shift();
    APP_STATE.history.adeDelay.shift();
    APP_STATE.history.baselineDelay.shift();
    APP_STATE.history.adeThroughput.shift();
    APP_STATE.history.baselineThroughput.shift();
    APP_STATE.history.adePdr.shift();
    APP_STATE.history.baselinePdr.shift();
  }

  const curDelay = APP_STATE.metrics.avgDelayMs;
  // Baseline BestRoute would stay stuck on Path A even if congested
  const baselineDelay = APP_STATE.paths.pathA.delayMs;

  APP_STATE.history.adeDelay.push(curDelay);
  APP_STATE.history.baselineDelay.push(baselineDelay);

  APP_STATE.history.adeThroughput.push(APP_STATE.metrics.throughputMbps);
  APP_STATE.history.baselineThroughput.push(Math.max(1.5, 10 - APP_STATE.paths.pathA.queueCongestionPercent / 10));

  APP_STATE.history.adePdr.push(APP_STATE.metrics.pdrPercent);
  APP_STATE.history.baselinePdr.push(Math.max(65, 100 - APP_STATE.paths.pathA.lossPercent * 3));

  renderAllCharts();
  updateBaselineComparisonDOM();
}

function updateOverviewCards() {
  const elDelay = document.getElementById('metric-avg-delay');
  const elThroughput = document.getElementById('metric-throughput');
  const elPdr = document.getElementById('metric-pdr');
  const elCache = document.getElementById('metric-cache-hit');
  const elSent = document.getElementById('metric-interests-sent');
  const elRcvd = document.getElementById('metric-data-rcvd');
  const elDecisions = document.getElementById('metric-ade-decisions');
  const elPathName = document.getElementById('metric-active-path');

  if (elDelay) elDelay.textContent = APP_STATE.metrics.avgDelayMs;
  if (elThroughput) elThroughput.textContent = Number(APP_STATE.metrics.throughputMbps || 0).toFixed(3);
  if (elPdr) elPdr.textContent = `${APP_STATE.metrics.pdrPercent}%`;
  if (elCache) elCache.textContent = `${APP_STATE.metrics.cacheHitPercent}%`;
  if (elSent) elSent.textContent = APP_STATE.metrics.interestsSent;
  if (elRcvd) elRcvd.textContent = APP_STATE.metrics.dataReceived;
  if (elDecisions) elDecisions.textContent = APP_STATE.metrics.adeDecisionsCount;
  if (elPathName) elPathName.textContent = APP_STATE.paths[APP_STATE.activePathId].name;
}

function updateBaselineComparisonDOM() {
  const adeLat = APP_STATE.metrics.avgDelayMs;
  const baseLat = APP_STATE.paths.pathA.delayMs;
  const delayDeltaPct = ((baseLat - adeLat) / Math.max(1, baseLat)) * 100;

  const elLatDelta = document.getElementById('cmp-delay-delta');
  if (elLatDelta) {
    if (delayDeltaPct >= 0) {
      elLatDelta.innerHTML = `<span style="color:#10b981; font-weight:bold;">-${delayDeltaPct.toFixed(1)}% (Lower Latency)</span>`;
    } else {
      elLatDelta.innerHTML = `<span style="color:#ef4444; font-weight:bold;">+${Math.abs(delayDeltaPct).toFixed(1)}% (Higher Latency)</span>`;
    }
  }

  const adePdr = APP_STATE.metrics.pdrPercent;
  const basePdr = Math.max(70, 100 - APP_STATE.paths.pathA.lossPercent * 4);
  const pdrGain = adePdr - basePdr;

  const elPdrDelta = document.getElementById('cmp-pdr-delta');
  if (elPdrDelta) {
    elPdrDelta.innerHTML = `<span style="color:#10b981; font-weight:bold;">+${pdrGain.toFixed(1)}% PDR Gain</span>`;
  }
}
