<div align="center">
  <img src="icons/icon128.png" height="128" width="128" alt="NeuroTab Logo" />
  <h1>NeuroTab</h1>
  <p><b>A highly opinionated, beautifully minimal Chrome extension to reclaim your focus.</b></p>
</div>

![NeuroTab UI](https://img.shields.io/badge/UI-Minimalist%20Dark-blue)
![Chrome Compatibility](https://img.shields.io/badge/Chrome-Manifest%20V3-success)
![License](https://img.shields.io/badge/License-MIT-green)

NeuroTab is a distraction-blocking browser extension that I built to help build better browsing habits. Whether you need a gentle nudge to stay on task or a strict, locked-down environment for a deep work session, NeuroTab adapts to your workflow.

> **Note:** This is a personal portfolio project built by [Harshad Nikam](https://github.com/harshhh19). It is fully open-source and intended to showcase frontend logic, Chrome Extension manifest v3 integration, and strict, state-driven UI patterns.

## Features
- **Deep Work Streaks:** Keep your daily distractions under 1 hour to build your focus streak. Share your stats with friends directly from the dashboard.
- **3 Distinct Modes:**
  - **Normal:** Browse freely.
  - **Focus:** Block defined distracting sites with a countdown timer.
  - **Exam:** A strict, locked-down mode that isolates a single tab, expands it to full screen, and aggressively blocks all tab switching, new windows, and keyboard shortcuts.
- **Comprehensive Dashboard:** View interactive charts detailing your productive vs. distracting time, manage website rules, and track your focus sessions.
- **Minimal, Ad-Free Design:** Built entirely with vanilla HTML, CSS, and JS. Designed to be fast, lightweight, and visually distraction-free with a sleek dark aesthetic.

---

## Installation (Developer / Sideloading)
NeuroTab is currently an open-source project and is **not** available on the Chrome Web Store. To use it, you must install it manually in developer mode.

1. **Clone or Download the Repository:**
   ```bash
   git clone https://github.com/harshhh19/NeuroTab.git
   ```
   *(Or click "Code" > "Download ZIP" and extract the files).*

2. **Open Chrome Extensions Page:**
   Navigate your browser to `chrome://extensions/`.

3. **Enable Developer Mode:**
   Toggle the **Developer mode** switch in the top right corner of the page.

4. **Load the Extension:**
   Click the **Load unpacked** button in the top left corner.
   Select the folder where you cloned/extracted the NeuroTab repository (the folder containing the `manifest.json` file).

5. **Pin it!**
   Click the Extensions icon in your Chrome toolbar and click the pin icon next to the **NeuroTab custom logo** so it's always accessible.

---

## Configuration
NeuroTab relies on establishing baseline rules. Before starting a Focus or Exam session, make sure to set up your rules:
1. Open the NeuroTab popup.
2. Click the **Dashboard** link at the bottom.
3. Navigate to the **Websites** tab.
4. Add the domains of the sites you visit (e.g., `youtube.com`, `github.com`) and categorize them as **Productive**, **Neutral**, or **Distracting**.

## How it Works
- **Storage:** All your data (stats, rules, streaks) remains completely localized to your machine utilizing Chrome's `storage.local` API. No data is sent to external servers.
- **Permissions:** The extension requires the following permissions to function fully:
  - `tabs` & `activeTab` - To monitor your active browsing and enforce Exam Mode tab locks.
  - `storage` - To save your preferences and focus data.
  - `alarms` - To handle timers in the background.
  - `scripting` - To inject the Exam Mode warning overlays.
  - `idle` - To pause tracking when you step away from your keyboard.

## Contributing
Contributions, issues, and feature requests are welcome! 
Feel free to check out the [issues page](https://github.com/harshhh19/NeuroTab/issues) to propose new features or report bugs.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Author
**Harsh**
- GitHub: [@dev-harshhh19](https://github.com/harshhh19)

## License
Distributed under the **MIT License**. See `LICENSE` for more information.
