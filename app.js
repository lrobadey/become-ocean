// --- START OF FILE app.js ---

document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded and parsed.");

  // --- Flags and Globals ---
  let isDragging = false;
  let lastDraggedMeasure = 1; // Initialize to start
  let justSeeked = false;
  let formalAnnotationsData = null;
  let x, y, xb, yb, xAxisGroup, yAxisGroup, brush, gBrush;
  let lineStr, lineBra, lineWin, areaStr, areaBra, areaWin;
  let lineOverviewStr, lineOverviewBra, lineOverviewWin;
  let stringsG, brassG, windsG;
  let marker, handle;
  let overviewMarker; // For the overview marker
  let metadata, tData, stringsData, brassData, windsData;
  let spm, total;
  let formalEnergyG, lineFormalEnergy, formalEnergy; // Specific to Formal Energy

  // --- Audio and Play/Pause Button Setup ---
  const audio = document.getElementById('audio');
  const container = document.getElementById('visualizer');
  const playPauseButton = document.getElementById('play-pause-button');

  const playIconSVG = `<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path></svg>`;
  const pauseIconSVG = `<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm1 4a1 1 0 100 2h4a1 1 0 100-2H8z" clip-rule="evenodd"></path></svg>`;

  function updatePlayPauseIcon() {
    if (!audio || !playPauseButton) return;
    if (audio.paused) {
      playPauseButton.innerHTML = playIconSVG;
      playPauseButton.setAttribute('aria-label', 'Play');
    } else {
      playPauseButton.innerHTML = pauseIconSVG;
      playPauseButton.setAttribute('aria-label', 'Pause');
    }
  }

  // --- UPDATED Play/Pause Button Listener ---
  if (playPauseButton) {
    playPauseButton.addEventListener('click', () => {
      if (!audio) return;

      if (audio.paused) {
        // --- Ensure playback starts from the marker position ---
        // Calculate the time corresponding to the marker's last known position
        const expectedTime = Math.max(0, (lastDraggedMeasure - 1) * spm);
        const currentTime = audio.currentTime;
        const timeDifference = Math.abs(currentTime - expectedTime);

        console.log(`Play clicked. Marker @ Measure: ${lastDraggedMeasure.toFixed(1)}, Expected Time: ${expectedTime.toFixed(2)}, Current Audio Time: ${currentTime.toFixed(2)}`);

        // If the audio's current time is significantly different from where the marker is
        // (e.g., > 0.1 seconds), reset it just before playing.
        // This handles cases where the previous seek might not have fully registered before play was clicked.
        if (timeDifference > 0.1) {
            console.warn(`Discrepancy detected. Resetting audio time to ${expectedTime.toFixed(2)} before playing.`);
            audio.currentTime = expectedTime;
            // Setting currentTime again might trigger another 'seeked' event, but the 'justSeeked' flag
            // and the logic in 'seeked' should handle this gracefully.
            justSeeked = true; // Treat this manual setting like a drag-seek start
        }

        // Initiate playback
        audio.play().catch(e => {
          console.error("Play failed:", e);
          console.error(`Play failed state: readyState=${audio.readyState}, currentTime=${audio.currentTime.toFixed(2)}`);
          justSeeked = false; // Reset flag if play fails
        });
        // --- End Modification ---

      } else {
        // If audio is playing, just pause it.
        audio.pause();
      }
    });
  } else {
    console.error("Play/Pause button not found.");
  }
  // --- END UPDATED Play/Pause Button Listener ---


  if (audio) {
    audio.addEventListener('play', () => { // Play listener
      justSeeked = false; // Ensure flag is false when playback definitely starts
      updatePlayPauseIcon();
    });
    audio.addEventListener('pause', () => { // Pause listener
      if (!isDragging) { // Only reset if pause wasn't caused by drag start
           justSeeked = false;
      }
      updatePlayPauseIcon(); // Update icon regardless
    });
    audio.addEventListener('ended', () => { // Ended listener
       justSeeked = false;
       updatePlayPauseIcon();
    });

    // Error listener from previous step
    audio.addEventListener('error', (e) => {
        console.error("Audio Element Error:", audio.error);
        alert(`Audio Error: ${audio.error?.message || 'Unknown Error'} (Code: ${audio.error?.code || 'N/A'})`);
    });

    updatePlayPauseIcon(); // Initialize icon state
  } else {
    console.error("Audio element not found.");
  }

  // --- D3 Visualization Setup ---
  const margin = { top: 80, right: 20, bottom: 150, left: 50 };
  let width = container.clientWidth - margin.left - margin.right;
  let height = container.clientHeight - margin.top - margin.bottom - 100;
  const brushHeight = 80;
  if (width <= 0 || height <= 0) {
    width = Math.max(width, 600);
    height = Math.max(height, 250);
    console.warn("Container size fallback.");
  } else {
     console.log(`Container dimensions: width=${width}, height=${height}`);
  }


  const svg = d3.select(container)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom + 100)
    .append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  const zoomG = svg.append('g')
    .attr('clip-path', 'url(#clip)');

  const overviewG = svg.append('g')
    .attr('transform', `translate(0, ${height + 40})`);

  svg.append('defs').append('clipPath')
    .attr('id', 'clip')
    .append('rect')
    .attr('width', width)
    .attr('height', height);

  // --- Load Data ---
  d3.json('data_sine.json').then((data) => {
    console.log("Data loaded.");
    metadata = data.metadata;
    tData = data.t;
    stringsData = data.strings;
    brassData = data.brass;
    windsData = data.winds;

    if (!metadata || !tData || !stringsData || !brassData || !windsData)
      throw new Error("JSON data invalid.");

    total = metadata.total_measures;
    spm = metadata.seconds_per_measure;
    console.log(`Data parsed: Measures=${total}, SPM=${spm}`);

    // --- Define Scales ---
    x = d3.scaleLinear().domain([1, total]).range([0, width]);
    y = d3.scaleLinear().domain([0, 1]).range([height, 0]);
    xb = d3.scaleLinear().domain([1, total]).range([0, width]);
    yb = d3.scaleLinear().domain([0, 1]).range([brushHeight, 0]);

    // --- Dynamic Multiplier Functions ---
    const dynStringsArr = [0.6, 0.6, 0.8, 1.0, 0.8, 0.6, 0.6, 0.6, 0.6, 0.8, 1.0, 0.8, 0.6, 0.6, 0.6, 0.6, 0.8, 1.0, 0.8, 0.6, 0.6];
    const dynBrassArr   = [0.6, 1.0, 0.6, 0.6, 1.0, 0.6, 0.6, 1.0, 0.6];
    const dynWindsArr   = [0.6, 0.8, 1.0, 0.8, 0.6, 0.6, 0.8, 1.0, 0.8, 0.6, 0.6, 0.8, 1.0, 0.8, 0.6];

    function dynamicStringsFn(m) { return dynStringsArr[Math.floor((m - 1) / 30)] || 0; }
    function dynamicBrassFn(m) { if (m < 9) return 0; return dynBrassArr[Math.floor((m - 9) / 70)] || 0; }
    function dynamicWindsFn(m) { if (m < 6) return 0; return dynWindsArr[Math.floor((m - 6) / 42)] || 0; }

    // --- Define Line & Area Generators (Instruments) ---
    lineStr = d3.line().x((d, i) => x(tData[i])).y((d, i) => y(d * dynamicStringsFn(tData[i])));
    lineBra = d3.line().x((d, i) => x(tData[i])).y((d, i) => y(d * dynamicBrassFn(tData[i])));
    lineWin = d3.line().x((d, i) => x(tData[i])).y((d, i) => y(d * dynamicWindsFn(tData[i])));
    areaStr = d3.area().x((d, i) => x(tData[i])).y0(height).y1((d, i) => y(d * dynamicStringsFn(tData[i])));
    areaBra = d3.area().x((d, i) => x(tData[i])).y0(height).y1((d, i) => y(d * dynamicBrassFn(tData[i])));
    areaWin = d3.area().x((d, i) => x(tData[i])).y0(height).y1((d, i) => y(d * dynamicWindsFn(tData[i])));

    // --- Define Line Generator (Formal Energy) ---
    lineFormalEnergy = d3.line()
      .x((d, i) => x(tData[i]))
      .y(d => y(d));

    // --- Draw Background ---
    zoomG.append('rect').attr('class', 'chart-background').attr('width', width).attr('height', height).attr('fill', "#081A2B");

    // --- Draw Axes ---
    xAxisGroup = svg.append('g').attr('transform', `translate(0, ${height})`).attr('class', 'axis axis--x').call(d3.axisBottom(x).ticks(10));
    yAxisGroup = svg.append('g').attr('class', 'axis axis--y').call(d3.axisLeft(y).ticks(5));

    // --- Create Waveform Groups (Instruments) ---
    stringsG = zoomG.append('g').attr('class', 'strings-group');
    brassG = zoomG.append('g').attr('class', 'brass-group');
    windsG = zoomG.append('g').attr('class', 'winds-group');

    // --- Draw Waveforms (Instruments) ---
    const areaOpacity = 0.4;
    stringsG.append('path').datum(stringsData).attr('class', 'area strings-area').attr('d', areaStr).attr('fill', "#7DD3FC").attr('fill-opacity', areaOpacity).attr('stroke', 'none').style('pointer-events', 'none');
    stringsG.append('path').datum(stringsData).attr('class', 'line strings-line').attr('d', lineStr).attr('stroke', "#7DD3FC").attr('stroke-width', 2).attr('fill', 'none').style('pointer-events', 'none');
    brassG.append('path').datum(brassData).attr('class', 'area brass-area').attr('d', areaBra).attr('fill', "#1E40AF").attr('fill-opacity', areaOpacity).attr('stroke', 'none').style('pointer-events', 'none');
    brassG.append('path').datum(brassData).attr('class', 'line brass-line').attr('d', lineBra).attr('stroke', "#1E40AF").attr('stroke-width', 3).attr('fill', 'none').style('pointer-events', 'none');
    windsG.append('path').datum(windsData).attr('class', 'area winds-area').attr('d', areaWin).attr('fill', "#14B8A6").attr('fill-opacity', areaOpacity).attr('stroke', 'none').style('pointer-events', 'none');
    windsG.append('path').datum(windsData).attr('class', 'line winds-line').attr('d', lineWin).attr('stroke', "#14B8A6").attr('stroke-width', 3).attr('fill', 'none').style('pointer-events', 'none');
    console.log("Instrument waveforms drawn.");

    // --- Calculate and Draw Formal Energy Waveform ---
    const WEIGHT_STRINGS = 0.25;
    const WEIGHT_WINDS =   0.33;
    const WEIGHT_BRASS =   0.42;
    console.log(`Formal Energy Weights: Str=${WEIGHT_STRINGS}, Wnd=${WEIGHT_WINDS}, Bra=${WEIGHT_BRASS}`);
    const instantaneousEnergy = tData.map((measure, i) => {
        if (i >= stringsData.length || i >= brassData.length || i >= windsData.length) return 0;
        const stringsVal = stringsData[i] * dynamicStringsFn(measure);
        const brassVal = brassData[i] * dynamicBrassFn(measure);
        const windsVal = windsData[i] * dynamicWindsFn(measure);
        return (stringsVal * WEIGHT_STRINGS) + (windsVal * WEIGHT_WINDS) + (brassVal * WEIGHT_BRASS);
    });
    const windowDurationSeconds = 120;
    const windowSizeMeasures = Math.max(1, Math.round(windowDurationSeconds / spm));
    const halfWindow = Math.floor(windowSizeMeasures / 2);
    console.log(`Calculating centered moving average with window size: ${windowSizeMeasures}, halfWindow: ${halfWindow}`);
    const paddedInstantaneousEnergy = Array(halfWindow).fill(0).concat(instantaneousEnergy);
    const paddedSmoothedEnergy = [];
    for (let i = 0; i < paddedInstantaneousEnergy.length; i++) {
        const windowStart = Math.max(0, i - halfWindow);
        const windowEnd = Math.min(paddedInstantaneousEnergy.length, i + halfWindow + 1);
        const windowData = paddedInstantaneousEnergy.slice(windowStart, windowEnd);
        const sum = windowData.reduce((acc, val) => acc + val, 0);
        const average = windowData.length > 0 ? sum / windowData.length : 0;
        paddedSmoothedEnergy.push(average);
    }
    const smoothedEnergy = paddedSmoothedEnergy.slice(halfWindow, halfWindow + instantaneousEnergy.length);
    const maxSmoothedEnergy = d3.max(smoothedEnergy);
    formalEnergy = smoothedEnergy.map(d => maxSmoothedEnergy > 0 ? d / maxSmoothedEnergy : 0);
    formalEnergyG = zoomG.append('g')
      .attr('class','formal-energy-layer')
      .style('display','none');
    formalEnergyG.append('path')
      .datum(formalEnergy)
      .attr('class','line formal-energy-line')
      .attr('d', lineFormalEnergy)
      .attr('stroke','#006400')
      .attr('stroke-width', 2)
      .attr('fill', 'none')
      .style('pointer-events', 'none');
    console.log("Padded & Weighted & Centered Smoothed formal energy waveform drawn (initially hidden).");


    // --- Draw Main Marker and Handle ---
    marker = zoomG.append('line')
      .attr('class', 'marker')
      .attr('y1', 0).attr('y2', height)
      .attr('stroke', "#FFFFFF").attr('stroke-width', 2).attr('stroke-opacity', 0.8)
      .style('pointer-events', 'none')
      .attr('x1', 0).attr('x2', 0);
    handle = zoomG.append('line')
      .attr('class', 'handle')
      .attr('y1', 0).attr('y2', height)
      .attr('stroke', 'transparent').attr('stroke-width', 20)
      .style('cursor', 'ew-resize')
      .attr('x1', 0).attr('x2', 0);
    console.log("Main Marker and Handle appended.");

    // --- Setup Overview and Brush ---
    overviewG.append('rect').attr('width', width).attr('height', brushHeight).attr('fill', "#112940").attr('rx', 3).attr('ry', 3);
    lineOverviewStr = d3.line().x((d, i) => xb(tData[i])).y((d, i) => yb(d * dynamicStringsFn(tData[i])));
    lineOverviewBra = d3.line().x((d, i) => xb(tData[i])).y((d, i) => yb(d * dynamicBrassFn(tData[i])));
    lineOverviewWin = d3.line().x((d, i) => xb(tData[i])).y((d, i) => yb(d * dynamicWindsFn(tData[i])));
    overviewG.append('path').datum(stringsData).attr('class', 'overview-line').attr('d', lineOverviewStr).attr('stroke', "#7DD3FC").attr('stroke-width', 1).attr('fill', 'none').attr('opacity', 0.6);
    overviewG.append('path').datum(brassData).attr('class', 'overview-line').attr('d', lineOverviewBra).attr('stroke', "#1E40AF").attr('stroke-width', 1).attr('fill', 'none').attr('opacity', 0.6);
    overviewG.append('path').datum(windsData).attr('class', 'overview-line').attr('d', lineOverviewWin).attr('stroke', "#14B8A6").attr('stroke-width', 1).attr('fill', 'none').attr('opacity', 0.6);

    overviewMarker = overviewG.append('line')
      .attr('class', 'overview-marker')
      .attr('y1', 0).attr('y2', brushHeight)
      .attr('stroke', '#FFD700')
      .attr('stroke-width', 1).attr('stroke-opacity', 0.9)
      .style('pointer-events', 'none')
      .attr('x1', xb(1)).attr('x2', xb(1));
    console.log("Overview marker created.");

    brush = d3.brushX().extent([[0, 0], [width, brushHeight]]).on('brush end', handleBrush);
    gBrush = overviewG.append('g')
      .attr('class', 'brush')
      .call(brush);

    // --- Load and Draw Formal Annotations ---
    d3.json('formal_annotations.json').then((annotations) => {
        formalAnnotationsData = annotations;
        drawFormalAnnotations(formalAnnotationsData);
      }).catch(error => {
        console.error("Error loading formal annotations:", error);
    });

    // --- Set Default Zoom to First 200 Measures ---
    const defaultDomain = [1, Math.min(200, total)];
    x.domain(defaultDomain);
    xAxisGroup.call(d3.axisBottom(x).ticks(10));
    redraw();
    gBrush.call(brush.move, [xb(defaultDomain[0]), xb(defaultDomain[1])]);
    console.log("Overview, Brush, and initial zoom setup complete.");

    // --- Attach Drag Handler for Marker ---
    if (handle) {
      handle.call(
        d3.drag()
          .on('start', () => {
              isDragging = true;
              audio.pause(); // Pause audio during drag
              console.log("Drag Start");
          })
          .on('drag', (event) => {
            if (!isDragging) return;
            let newX = event.x;
            newX = Math.max(0, Math.min(newX, width));
            const newMeasure = x.invert(newX);
            // Update lastDraggedMeasure continuously during drag, clamped
            lastDraggedMeasure = Math.max(1, Math.min(newMeasure, total));
            setMarker(lastDraggedMeasure); // Update main marker instantly

            // Update Overview Marker during Drag
            if (overviewMarker && xb) {
                 const overviewPosX = xb(lastDraggedMeasure);
                 const clampedOverviewPosX = Math.max(0, Math.min(width, overviewPosX));
                 overviewMarker.attr('x1', clampedOverviewPosX).attr('x2', clampedOverviewPosX);
            }

            // Update display during drag
            const currentMeasureDisplay = document.getElementById('current-measure');
            if (currentMeasureDisplay) {
              currentMeasureDisplay.textContent = lastDraggedMeasure.toFixed(1);
            }
          })
          .on('end', () => { // Logic with diagnostic checks from previous step
            if (!isDragging) return;
            isDragging = false;
            // Marker is already visually positioned. Ensure final value is used.
            setMarker(lastDraggedMeasure);

            // Update overview marker to match final drag position
             if (overviewMarker && xb) {
                 const overviewPosX = xb(lastDraggedMeasure);
                 const clampedOverviewPosX = Math.max(0, Math.min(width, overviewPosX));
                 overviewMarker.attr('x1', clampedOverviewPosX).attr('x2', clampedOverviewPosX);
             }

            // Update the display with final value
            const currentMeasureDisplay = document.getElementById('current-measure');
            if (currentMeasureDisplay) {
                currentMeasureDisplay.textContent = lastDraggedMeasure.toFixed(1);
            }

            // Calculate the target time
            const targetTime = Math.max(0, (lastDraggedMeasure - 1) * spm);

            // --- Add Diagnostic Logging ---
            console.log(`Drag End Attempt: Measure=${lastDraggedMeasure.toFixed(1)}, TargetTime=${targetTime.toFixed(2)}, Duration=${audio.duration?.toFixed(2)}, ReadyState=${audio.readyState}`);
            if (audio.seekable && audio.seekable.length > 0) {
                 // Ensure we check within bounds before accessing seekable range
                const seekableEnd = audio.seekable.length > 0 ? audio.seekable.end(audio.seekable.length - 1) : 0;
                const seekableStart = audio.seekable.length > 0 ? audio.seekable.start(0) : 0;
                console.log(`Seekable Range: [${seekableStart.toFixed(2)}, ${seekableEnd.toFixed(2)}]`);
            } else {
                console.log("Audio reporting not seekable or seekable range unavailable.");
            }
            // --- End Diagnostic Logging ---


            // --- CHECK AUDIO STATE BEFORE SEEKING ---
            let canSeek = audio.readyState >= 1; // HAVE_METADATA at least
            if (!isNaN(audio.duration)) {
                canSeek = canSeek && targetTime <= audio.duration;
            }
            if (audio.seekable && audio.seekable.length > 0) {
                const seekableEnd = audio.seekable.end(audio.seekable.length - 1); // Check the end of the last range
                canSeek = canSeek && targetTime <= seekableEnd;
            } else {
                // If seekable isn't reported, we might still try, but log a warning
                console.log("Seekable property not available or empty, proceeding with seek attempt cautiously.");
            }


            if (canSeek) {
                try {
                    justSeeked = true; // Set flag *only if* attempting seek
                    console.log("Condition met: Setting justSeeked = true, attempting seek...");
                    audio.currentTime = targetTime; // Attempt seek
                    console.log(`Drag End - Seek initiated to time: ${targetTime.toFixed(2)}`);
                } catch (err) {
                    console.error("Error setting currentTime:", err);
                    justSeeked = false; // Reset flag if seek assignment itself threw error
                }
            } else {
                console.warn(`Seek prevented or likely to fail: TargetTime=${targetTime.toFixed(2)}, ReadyState=${audio.readyState}, CanSeek=${canSeek}`);
                justSeeked = false; // Reset flag if we didn't attempt the seek
            }
            // --- END CHECK ---
          })
      );
      console.log("Drag handler attached.");
    } else {
      console.error("Handle not defined, cannot attach drag.");
    }

    // --- Initialize Playback and Setup Custom Toggles ---
    initializePlayback();
    setupToggles();

  }).catch(error => {
    console.error('Error loading/processing data:', error);
    container.innerHTML = `<p style="color: red; padding: 20px;">Error loading data: ${error.message}. Check console.</p>`;
    updatePlayPauseIcon();
    if (playPauseButton) playPauseButton.disabled = true;
  });

  // --- Helper Functions ---

  function setMarker(meas) {
      if (!x || !marker || !handle || !audio) return;
      if (isNaN(meas) || !isFinite(meas)) {
          console.warn(`setMarker skipped: Invalid measure (${meas}).`); return;
      }
      // Clamp measure to valid range [1, total] before calculating position
      const clampedMeas = Math.max(1, Math.min(meas, total));

      const currentDomain = x.domain();
      // Use the clamped measure for position calculation
      const pos = x(clampedMeas);

      if (isNaN(pos) || !isFinite(pos)) {
           console.warn(`setMarker skipped: Calculated invalid position (${pos}) for measure ${clampedMeas}.`); return;
      }

      // Visibility check uses the *original* potentially un-clamped measure (meas)
      // Ensure it's compared against the current zoom domain
      const isInView = meas >= currentDomain[0] && meas <= currentDomain[1];

      marker.attr('x1', pos).attr('x2', pos)
            .attr('stroke-opacity', isInView ? 0.8 : 0);
      handle.attr('x1', pos).attr('x2', pos)
            .style('cursor', isInView ? 'ew-resize' : 'default'); // Ensure cursor updates based on visibility
  }


  function handleBrush(event) {
      if (!event.selection) {
          return; // Do nothing if selection is cleared
      }
      const [x0, x1] = event.selection;
      const newDomain = [xb.invert(x0), xb.invert(x1)];
      x.domain(newDomain); // Update main chart x-scale
      xAxisGroup.call(d3.axisBottom(x).ticks(10)); // Redraw x-axis
      redraw(); // Redraw waveforms and annotations

      // Update marker position based on current state after redraw
      let currentMeasure;
      if (isDragging) {
          currentMeasure = lastDraggedMeasure; // Use drag position if currently dragging
      } else if (audio) {
           // Use the actual audio time if not dragging
          currentMeasure = 1 + (audio.currentTime / spm);
      } else {
          currentMeasure = 1; // Fallback if audio not ready
      }

      // Ensure the calculated measure is valid before setting marker
      currentMeasure = Math.max(1, Math.min(currentMeasure, total));

      setMarker(currentMeasure); // Update main marker position/visibility

      // Update overview marker as well
      if (overviewMarker && xb) {
          const overviewPosX = xb(currentMeasure);
          const clampedOverviewPosX = Math.max(0, Math.min(width, overviewPosX));
          overviewMarker.attr('x1', clampedOverviewPosX).attr('x2', clampedOverviewPosX);
      }
  }

  function redraw() {
      // Redraw elements based on the current x-domain
      if (!stringsG || !brassG || !windsG || !x) return;

      stringsG.selectAll('.area').attr('d', areaStr);
      stringsG.selectAll('.line').attr('d', lineStr);
      brassG.selectAll('.area').attr('d', areaBra);
      brassG.selectAll('.line').attr('d', lineBra);
      windsG.selectAll('.area').attr('d', areaWin);
      windsG.selectAll('.line').attr('d', lineWin);

      if (formalEnergyG) {
        formalEnergyG.selectAll('.formal-energy-line')
          .datum(formalEnergy)
          .attr('d', lineFormalEnergy);
      }

      if (formalAnnotationsData) {
        drawFormalAnnotations(formalAnnotationsData);
      }
  }

  function initializePlayback() {
    if (!audio) return;

    // Timeupdate listener (updates marker during normal playback)
    audio.addEventListener('timeupdate', () => {
      if (isDragging || justSeeked) {
           return; // Skip update if dragging or immediately after a seek request
      }

      const currentTime = audio.currentTime;
      const currentMeasure = 1 + (currentTime / spm);
      // Update lastDraggedMeasure ONLY during playback/timeupdate when NOT dragging
      // This ensures clicking play after pausing uses the paused position.
      if (!isDragging) {
          lastDraggedMeasure = currentMeasure;
      }

      setMarker(currentMeasure); // Update main marker

      // Update Overview Marker
      if (overviewMarker && xb) {
           const overviewPosX = xb(currentMeasure);
           const clampedOverviewPosX = Math.max(0, Math.min(width, overviewPosX));
           overviewMarker.attr('x1', clampedOverviewPosX).attr('x2', clampedOverviewPosX);
      }

      const currentMeasureDisplay = document.getElementById('current-measure');
      if (currentMeasureDisplay) {
        currentMeasureDisplay.textContent = currentMeasure.toFixed(1);
      }
    });

    // Seeked listener (finalizes marker position after any seek)
    audio.addEventListener('seeked', () => {
        if (isDragging) return; // Safety check

        console.log("Seeked event fired. Resetting justSeeked = false");
        justSeeked = false; // Allow timeupdate to resume

        // Update marker/display based on actual time after seek is complete
        const currentMeasure = 1 + (audio.currentTime / spm);
         // Also update lastDraggedMeasure here to sync state after seek
        lastDraggedMeasure = currentMeasure;

        setMarker(currentMeasure); // Explicitly set marker

        if (overviewMarker && xb) { // Update overview marker too
          const overviewPosX = xb(currentMeasure);
          const clampedOverviewPosX = Math.max(0, Math.min(width, overviewPosX));
          overviewMarker.attr('x1', clampedOverviewPosX).attr('x2', clampedOverviewPosX);
        }

        const currentMeasureDisplay = document.getElementById('current-measure');
        if (currentMeasureDisplay) {
            currentMeasureDisplay.textContent = currentMeasure.toFixed(1);
        }
        console.log(`Seeked complete. Audio time: ${audio.currentTime.toFixed(2)}, Measure: ${currentMeasure.toFixed(1)}`);
    });
  }

  function drawFormalAnnotations(annotations) {
      // Draws annotations based on current x-scale domain
      if (!svg || !x) return;

      const annotationLayer = svg.selectAll('.formal-annotations-layer').data([null]);
      const annotationLayerEnter = annotationLayer.enter().append('g')
          .attr('class', 'formal-annotations-layer');
      const annotationLayerUpdate = annotationLayerEnter.merge(annotationLayer);
      annotationLayerUpdate.selectAll('*').remove(); // Clear previous

      const domain = x.domain(); // Get current zoom range

      annotations.forEach(ann => {
        const startX = x(ann.start);
        const endX = x(ann.end);
        const measureX = x(ann.measure);


        // Check if the annotation is within the current view
        const isSectionInView = ann.type === "section" && ann.end > domain[0] && ann.start < domain[1];
        const isMarkerInView = ann.type === "marker" && ann.measure >= domain[0] && ann.measure <= domain[1];

        if (isSectionInView) {
           // Clamp drawing coordinates to the visible area
           const drawStartX = Math.max(0, startX);
           const drawEndX = Math.min(width, endX);
           const drawWidth = Math.max(0, drawEndX - drawStartX);

           if (drawWidth > 0) {
                annotationLayerUpdate.append('rect')
                  .attr('x', drawStartX).attr('y', -60).attr('width', drawWidth)
                  .attr('height', 20).attr('fill', ann.color).attr('opacity', 0.3);

               // Calculate midpoint based on original measure values, then check if in view for label
               const midMeasure = (ann.start + ann.end) / 2;
               const midX = x(midMeasure);
               if (midX >= 0 && midX <= width) { // Only draw label if midpoint is visible
                  annotationLayerUpdate.append('text')
                      .attr('x', midX).attr('y', -45).text(ann.label)
                      .attr('fill', ann.color).attr('font-size', 10).attr('text-anchor', 'middle')
                      .style('pointer-events', 'none');
               }
           }
        } else if (isMarkerInView) {
          // Check if marker position is within bounds before drawing
          if (measureX >= 0 && measureX <= width) {
              annotationLayerUpdate.append('line')
                .attr('x1', measureX).attr('x2', measureX).attr('y1', -60).attr('y2', height)
                .attr('stroke', ann.color).attr('stroke-width', 1).attr('stroke-dasharray', '2,2');
              annotationLayerUpdate.append('text')
                .attr('x', measureX + 3).attr('y', -65).text(ann.label)
                .attr('fill', ann.color).attr('font-size', 10).style('pointer-events', 'none');
          }
        }
      });
  }

  function setupToggles() {
    // Sets up click handlers for the toggle buttons
    const toggleStrings = document.getElementById('toggle-strings');
    const toggleBrass = document.getElementById('toggle-brass');
    const toggleWinds = document.getElementById('toggle-winds');
    const toggleFormal = document.getElementById('toggle-formal');

    if (toggleStrings) {
      toggleStrings.addEventListener('click', () => {
          const isActive = toggleStrings.classList.toggle('active');
          if (stringsG) stringsG.style("display", isActive ? "inline" : "none");
      });
    }
     if (toggleBrass) {
        toggleBrass.addEventListener('click', () => {
          const isActive = toggleBrass.classList.toggle('active');
          if (brassG) brassG.style("display", isActive ? "inline" : "none");
        });
     }
     if (toggleWinds) {
        toggleWinds.addEventListener('click', () => {
          const isActive = toggleWinds.classList.toggle('active');
          if (windsG) windsG.style("display", isActive ? "inline" : "none");
        });
     }
     if (toggleFormal) {
        toggleFormal.addEventListener('click', () => {
          const isActive = toggleFormal.classList.toggle('active');
          if (formalEnergyG) {
              formalEnergyG.style('display', isActive ? 'inline' : 'none');
          }
        });
     }
  }

}); // End DOMContentLoaded