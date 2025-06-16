let seismicData = [];        // Vector de datos cargados
let currentIndex = 0;        // Índice del instante actual
let playInterval = null;
let samplingRate = 0;        // Calculado tras la carga 
let baselineENE = 0; // Media de ENE en la ventana inicial
let baselineENN = 0; // Media de ENN en la ventana inicial
let baselineENZ = 0; // Media de ENZ en la ventana inicial
// Arreglos por componente y magnitud
let times = [], M = [], ENE = [], ENN = [], ENZ = [];

let windowMs = 5000;
let stepMs = 500
let animationId;                       // para requestAnimationFrame
const speedFactor = 0.5; 
// 1) Carga de datos y arranque
d3.csv('earthquake_data.csv', row => {
    const dt = row.datetime.trim().replace(' ', 'T');
    return {
        datetime: new Date(dt),
        ENE:   +row.ENE,
        ENN:   +row.ENN,
        ENZ:   +row.ENZ,
        M:     +row.M
    };
}).then(parsed => {
    seismicData = parsed;
    
    // Extraer arrays
    times = parsed.map(d => d.datetime);
    M     = parsed.map(d => d.M);
    ENE   = parsed.map(d => d.ENE);
    ENN   = parsed.map(d => d.ENN);
    ENZ   = parsed.map(d => d.ENZ);
    minENE = Math.min(...ENE);  maxENE = Math.max(...ENE);
    minENN = Math.min(...ENN);  maxENN = Math.max(...ENN);
    minENZ = Math.min(...ENZ);  maxENZ = Math.max(...ENZ);
    // Calcular samplingRate (Hz)
    const dt = (times[1] - times[0]) / 1000; // segundos
    samplingRate = 1 / dt;

  const baselineSamples = Math.floor(samplingRate * 3); // 3 segundos
  
  baselineE = d3.mean(M.slice(0, baselineSamples));
  baselineENE = d3.mean(ENE.slice(0, baselineSamples));
  baselineENN = d3.mean(ENN.slice(0, baselineSamples));
  baselineENZ = d3.mean(ENZ.slice(0, baselineSamples));

    initDashboard();
});

function initDashboard() {

  const flatLayout = {
    width: 120,
    height: 40,
    margin: { l: 0, r: 0, t: 0, b: 0, pad: 0 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    xaxis: {
      visible: false,
      fixedrange: true,
      zeroline: false,
      showgrid: false
    },
    yaxis: {
      visible: false,
      fixedrange: true,
      zeroline: false,
      showgrid: false,
      autorange:false,
      range: [-1.5, 1.5] // rango fijo para las mini-ondas
    },
    annotations: []  // quita cualquier texto incrustado
  };

  const flatConfig = {
    staticPlot: true,      // sin interacción
    displayModeBar: false  // sin barra de herramientas
  };



  ['eneChart','ennChart','enzChart'].forEach((id,i)=>{
    Plotly.newPlot(
      id,
      [{
        x: times.slice(currentIndex-1,currentIndex+1),
        y: [ENE,ENN,ENZ][i].slice(currentIndex-1,currentIndex+1),
        mode: 'lines',
        line: { dash: 'solid', width: 1.5, color: ['#f6ad55','#63b3ed','#9ae6b4'][i] }
      }],
      flatLayout,
      flatConfig
    );
  });

  ['psdEne','psdEnn','psdEnz'].forEach((id,i)=>{
    Plotly.newPlot(
      id,
      [{
        x: [0.1,1,10],
        y: [0,0,0],
        mode: 'lines',
        line: { dash: 'dot', width: 1, color: ['#f6ad55','#63b3ed','#9ae6b4'][i] }
      }],
      flatLayout,
      flatConfig
    );
  });
// --- Gráfico de magnitud central CON Range Slider ---
const minM = Math.min(...M);
const maxM = Math.max(...M);


const tStart = times[0].getTime();


// Calcula el slice centrado en initialCenter
const center = window.initialCenter || 0;
const t0 = new Date(tStart);
const t1 = new Date(tStart + windowMs);

// Selección absoluta de fechas para ese tramo
const xSlice = times;
const ySlice = M;

Plotly.newPlot(
  'mainMagnitude',
  [{
    x: xSlice,
    y: ySlice,
    mode: 'lines',
    line: { color: '#9f7aea', width: 3 },
    hoverinfo: 'x+y'
  }],
  {
    margin: { t: 30, l: 50, r: 20, b: 40 },
    xaxis: {
      type: 'date',
      range: [ t0, t1 ],
      tickformat: '%H:%M:%S', 
      title: 'Tiempo (UTC)',
      rangeslider: {
        visible: true,
        thickness: 0.1,
        bgcolor: '#1a202c',
        borderwidth: 0
      }
    },
    yaxis: {
      title: 'M(t)',
      range: [ minM, maxM ],
      fixedrange: true
    }
  },
  {
    displayModeBar: false,
    staticPlot: false  // necesitamos interacción para el slider
  }
);
  // Inicializar con el primer instante
  updateDashboard(0);

  // Botones
  document.getElementById('playBtn').onclick  = play;
  document.getElementById('pauseBtn').onclick = pause;
  document.getElementById('resetBtn').onclick = reset;
}

  const flatLayout = {
    margin: { l:0, r:0, t:0, b:0, pad:0 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor:  'rgba(0,0,0,0)',
    xaxis: { visible:false, fixedrange:true, zeroline:false, showgrid:false },
    yaxis: { visible:false, fixedrange:true, zeroline:false, showgrid:false },
    showlegend: false
  };
  const flatConfig = { staticPlot:true, displayModeBar:false };

function updateDashboard(idx) {
  currentIndex = idx;
  const point = seismicData[idx];

  const currentTime = times[currentIndex];  // datetime del punto actual
  const formattedTime = new Date(currentTime).toLocaleTimeString();  // "03:52:41"

  document.getElementById('timer').textContent = `${formattedTime}`;
 
  // 2. Ventana de ±1 segundo
  const w  = Math.round(samplingRate * 1);
  const i0 = Math.max(0, idx - w);
  const i1 = Math.min(seismicData.length, idx + w);

  // 3. Construir arrays de segundos relativos y valores
  const baseTs = seismicData[idx].datetime.getTime();
  const slice   = seismicData.slice(i0, i1);
  const xs      = slice.map(d => (d.datetime.getTime() - baseTs) / 1000);
  const ye      = slice.map(d => d.ene);
  const yn      = slice.map(d => d.enn);
  const zz      = slice.map(d => d.enz);

  updateSeismicVisuals(ye, yn, zz);

  // 5. Actualizar mini‐gráficos
  [['eneChart', ye, '#f6ad55'],
   ['ennChart', yn, '#63b3ed'],
   ['enzChart', zz, '#9ae6b4']].forEach(([id, arr, color]) => {
    Plotly.react(
      id,
      [{ x: xs, y: arr, mode:'lines', line:{ color, width:1.5 } }],
      flatLayout,
      flatConfig
    );
  });


  [['psdEne', ye, '#f6ad55'],
   ['psdEnn', yn, '#63b3ed'],
   ['psdEnz', zz, '#9ae6b4']].forEach(([id, arr, color]) => {
    const { periods, sqrtPsd } = computeSqrtPSD(arr.slice(0, 256), 100);
    Plotly.react(
      id,
      [{ x: periods, y: sqrtPsd, mode:'lines', line:{ color, width:1.5 } }],
      {
    xaxis: { visible:false, fixedrange:true, zeroline:false, showgrid:false },
    yaxis: { visible:false, fixedrange:true, zeroline:false, showgrid:false },
    margin: { l:0, r:0, t:0, b:0, pad:0 },
  },
      flatConfig
    );
  });

  // 7. Resto de tu dashboard (mainMagnitude, timeline) queda igual...
}


function play() {
  if (animationId) return;            // ya está animando

  let lastTimestamp = null;
  const gd = document.getElementById('mainMagnitude');
  const lastTime  = times[times.length - 1].getTime();

  function step(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = timestamp - lastTimestamp;   // ms reales desde último frame
    lastTimestamp = timestamp;

    // obtenemos el rango actual en ms
    const xr = gd.layout.xaxis.range;
    let t0 = new Date(xr[0]).getTime() + dt * speedFactor;
    let t1 = new Date(xr[1]).getTime() + dt * speedFactor;

    // límite al final de los datos
    if (t1 >= lastTime) {
      t1 = lastTime;
      t0 = lastTime - windowMs;
      cancelAnimationFrame(animationId);
      animationId = null;
    } else {
      animationId = requestAnimationFrame(step);
    }

    Plotly.relayout(gd, {
      'xaxis.range': [new Date(t0), new Date(t1)]
    });

    // 2) Ahora recorta seismicData para esos ms:
    const slice = seismicData.filter(d =>
      d.datetime.getTime() >= t0 && d.datetime.getTime() <= t1
    );
    
    const xs   = slice.map(d => (d.datetime.getTime() - t0) / 1000);
    const ye   = slice.map(d => d.ENE);
    const yn   = slice.map(d => d.ENN);
    const zz   = slice.map(d => d.ENZ);

    const horaReal = new Date((t0 + t1) / 2).toLocaleTimeString(); // media del rango actual

    document.getElementById('timer').textContent = `${horaReal}`;

    updateSeismicVisuals(ye, yn, zz);

    // 3) Vuelve a dibujar las mini-ondas SIN slider
  [['eneChart', ye, '#f6ad55', [minENE, maxENE]],
   ['ennChart', yn, '#63b3ed', [minENN, maxENN]],
   ['enzChart', zz, '#9ae6b4', [minENZ, maxENZ]]]
  .forEach(([id, ys, color, [y0,y1]]) => {
    Plotly.react(
      id,
      [{ x: xs, y: ys, mode:'lines', line:{ color, width:1.5 } }],
      {
        margin: { l:0, r:0, t:0, b:0, pad:0 },
        xaxis: { visible:false, fixedrange:true },
        yaxis: { visible:false, fixedrange:true, autorange:false, range:[y0, y1] }
      },
      { staticPlot:true, displayModeBar:false }
    );
  });


  [['psdEne', ye, '#f6ad55'],
   ['psdEnn', yn, '#63b3ed'],
   ['psdEnz', zz, '#9ae6b4']].forEach(([id, arr, color]) => {
    const { periods, sqrtPsd } = computeSqrtPSD(arr.slice(0, 256), 100);
    Plotly.react(
      id,
      [{ x: periods, y: sqrtPsd, mode:'lines', line:{ color, width:1.5 } }],
      {
    xaxis: { visible:false, fixedrange:true, zeroline:false, showgrid:false },
    yaxis: { visible:false, fixedrange:true, zeroline:false, showgrid:false },
    margin: { l:0, r:0, t:0, b:0, pad:0 },
  },
      flatConfig
    );
  });


  }

  animationId = requestAnimationFrame(step);
}

function pause() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

function reset() {
  pause();
  const tStart = times[0].getTime();
  Plotly.relayout('mainMagnitude', {
    'xaxis.range': [
      new Date(tStart),
      new Date(tStart + windowMs)
    ]
  });
}

function hammingWindow(N) {
  return Array.from({length: N}, (_, n) => 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1)));
}

function computeSqrtPSD(signal, fs) {
  const N = signal.length;
  const real = new Array(N).fill(0);
  const imag = new Array(N).fill(0);

  for (let k = 0; k < N; k++) {
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      real[k] += signal[n] * Math.cos(-angle);
      imag[k] += signal[n] * Math.sin(-angle);
    }
  }

  const magnitude = real.map((re, i) => Math.sqrt(re * re + imag[i] * imag[i]) / N);
  const freqs = [];
  const halfMag = [];
  const periods = [];

  for (let i = 1; i < N / 2; i++) {  // desde i=1 para evitar freq=0 (∞ período)
    const f = i * fs / N;
    const p = 1 / f;
    freqs.push(f);
    periods.push(p);
    halfMag.push(magnitude[i]);
  }

  return { periods, sqrtPsd: halfMag };
}
 
function updateSeismicVisuals(ye, yn, zz) {
    const h = document.getElementById('ground-horizontal');
    const v = document.getElementById('ground-vertical');
    const scale = 0.00003
    ; 

    const x = (ye[ye.length - 1] - baselineENE) * scale;
    const y = (yn[yn.length - 1] - baselineENN) * scale;
    const z = (zz[zz.length - 1] - baselineENZ) * scale;


    h.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    v.style.transform = `translate(-50%, calc(-50% + ${-z}px))`;
}