(function () {
  if (window.neurotabExamActive) return;
  window.neurotabExamActive = true;

  const root = document.createElement('div');
  root.id = 'neurotab-exam-root';

  const overlay = document.createElement('div');
  overlay.id = 'neurotab-exam-overlay';

  const title = document.createElement('h1');
  title.textContent = 'Exam Mode Ready';
  title.style.margin = '0';
  title.style.fontSize = '32px';

  const desc = document.createElement('p');
  desc.textContent = 'Click the button below to enter fullscreen and begin lockdown.';
  desc.style.opacity = '0.8';

  const startBtn = document.createElement('button');
  startBtn.textContent = 'Start Exam (Enter Fullscreen)';

  overlay.appendChild(title);
  overlay.appendChild(desc);
  overlay.appendChild(startBtn);

  const timer = document.createElement('div');
  timer.id = 'neurotab-exam-timer';
  timer.className = 'hidden';
  timer.textContent = '--:--';

  const warning = document.createElement('div');
  warning.id = 'neurotab-violation-warning';
  const warningText = document.createElement('h1');
  warningText.textContent = 'VIOLATION DETECTED';
  warning.appendChild(warningText);

  root.appendChild(overlay);
  root.appendChild(timer);
  root.appendChild(warning);
  document.body.appendChild(root);

  let timerInterval = null;
  let examEndTime = 0;

  function updateTimer() {
    const remaining = Math.max(0, Math.floor((examEndTime - Date.now()) / 1000));
    const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
    const secs = (remaining % 60).toString().padStart(2, '0');
    timer.textContent = `${mins}:${secs}`;

    if (remaining <= 0) {
      timer.textContent = '00:00';
      clearInterval(timerInterval);
    }
  }

  // Fetch session to start timer
  chrome.runtime.sendMessage({ action: 'getStatus' }, (status) => {
    if (status && status.activeExamSession) {
      const session = status.activeExamSession;
      examEndTime = session.startTime + (session.duration * 1000);
      updateTimer();
      timerInterval = setInterval(updateTimer, 1000);
    }
  });

  startBtn.addEventListener('click', async () => {
    try {
      await document.documentElement.requestFullscreen();
      overlay.classList.add('hidden');
      timer.classList.remove('hidden');
    } catch (err) {
      alert(`Error attempting to enable fullscreen: ${err.message}`);
    }
  });

  function preventDefaultAction(e) {
    if (overlay.classList.contains('hidden')) {
      e.preventDefault();
    }
  }

  // Block right click
  document.addEventListener('contextmenu', preventDefaultAction, { capture: true });

  // Block shortcuts 
  document.addEventListener('keydown', (e) => {
    if (overlay.classList.contains('hidden') && (e.ctrlKey || e.metaKey)) {
      if (['c', 'v', 'x', 'a', 'p', 's', 'f', 't', 'n', 'w'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    }
  }, { capture: true });

  // Detect leaving fullscreen
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && overlay.classList.contains('hidden')) {
      chrome.runtime.sendMessage({ action: 'logExamViolationContent', type: 'exit_fullscreen' });
      overlay.classList.remove('hidden'); // Force re-entry
      timer.classList.add('hidden');
    }
  });

  // Detect visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.neurotabExamActive) {
      chrome.runtime.sendMessage({ action: 'logExamViolationContent', type: 'hidden_tab' });
    }
  });

  // Detect mouse leaving window
  document.addEventListener('mouseleave', () => {
    if (window.neurotabExamActive && !overlay.classList.contains('hidden')) {
      chrome.runtime.sendMessage({ action: 'logExamViolationContent', type: 'mouse_leave' });
    }
  });

  const messageListener = (message) => {
    if (message.action === 'examViolation') {
      warning.classList.add('active');
      setTimeout(() => {
        warning.classList.remove('active');
      }, 2000);
    } else if (message.action === 'endExam') {
      cleanup();
    }
  };
  chrome.runtime.onMessage.addListener(messageListener);

  function cleanup() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(e => console.log(e));
    }
    clearInterval(timerInterval);
    if (document.body.contains(root)) {
      root.remove();
    }
    chrome.runtime.onMessage.removeListener(messageListener);
    window.neurotabExamActive = false;
  }
})();
