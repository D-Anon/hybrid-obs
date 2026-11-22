# Hybrid OBS camera desk

One wired OBS computer hosts local camera pages and a private operator dashboard. Local cameras send WebRTC media directly to OBS. Remote guests use the public VDO.Ninja service. Each local slot supports one camera and one active viewer. Use the OBS preview to monitor it. Opening its viewer URL in a second browser takes over that slot.

## One-click setup and launch

Extract the full ZIP to a writable folder. The launcher checks Node.js (18 or newer), mkcert and OBS Studio. On Linux it also checks the NSS certificate utility. Existing programs are reused. Missing programs are installed through the platform package manager and checked again before startup. If you use a portable Windows OBS installation, add its bin\64bit directory to PATH so setup can recognize it.

| Platform | Run from the extracted folder |
| --- | --- |
| Windows 10/11 | Double-click **Setup-and-Start.cmd**. Uses winget to install missing programs. |
| macOS | Double-click **Setup-and-Start.command**. Missing dependencies install through Homebrew when available. If execute permissions were lost during extraction, open Terminal in this folder and run `bash setup.sh`. |
| Linux | Open a terminal in the folder and run `bash setup.sh`. On desktops supporting executable scripts, choose Run in Terminal. Supports apt and dnf when the required packages are available in your distribution. |

Use the same launcher for setup and future events. First-time package installation requires internet and may ask for administrator approval. If multiple network adapters are available, choose the venue Ethernet or Wi-Fi address. Setup reuses a valid local certificate or generates one for that address. The dashboard opens once both server ports are listening. Leave the terminal running throughout the event. Press Ctrl+C to stop it before launching another instance.

For each new phone or presenting laptop, follow the certificate trust instructions in step 4 below. The launcher prints the certificate folder. Transfer only the public rootCA.pem, and keep rootCA-key.pem private on the host. If Windows asks about firewall access, allow Node.js and OBS on the trusted private network. When updating an existing installation, keep slots.json, cert.pem, key.pem and .studio-certs if present.

## Requirements

- Windows, macOS or Linux production computer with OBS Studio including Browser Source, a current Node.js LTS release, and mkcert for initial certificate setup. No npm install is needed.
- One camera phone per angle, with a browser supporting WebRTC and trusted HTTPS. Keep phones charged, unlocked and in the foreground.
- Wi-Fi router or access point, Ethernet cable, and one private IPv4 address reserved for the OBS PC. Disable client isolation on the production Wi-Fi. The phone and OBS PC must be able to exchange local UDP media traffic.
- Internet for online guests or an outgoing broadcast. A remote guest needs a camera, browser and preferably headphones. A public broadcast also needs an account with the chosen destination. Local recording needs sufficient free disk space.
- Start with 720p at 30 fps per phone. Test the actual scene count under load. A hardware video encoder is helpful. The local server, OBS and dashboard can run on the same computer.

## First-time setup

1. Install OBS Studio, Node.js LTS and mkcert on the production computer. Extract the ZIP and open a terminal in the folder containing server.js.
2. Find the computer's wired IPv4 address (on Windows, run ipconfig). Reserve it in the router. Substitute your address for 192.168.1.50 in both commands below.
3. Generate a locally trusted certificate in the extracted folder:

       mkcert -install
       mkcert -cert-file cert.pem -key-file key.pem 192.168.1.50

4. Run mkcert -CAROOT to locate rootCA.pem. Transfer ONLY rootCA.pem to each camera phone over a trusted channel and install it as a trusted CA. Keep rootCA-key.pem private on the issuing PC. On Android, search Settings for “Install a CA certificate” (some devices require the certificate file extension .crt). On iOS, install the downloaded profile, then enable full trust in Settings > General > About > Certificate Trust Settings. School-managed phones may require administrator enrollment. Restart browsers and OBS after installing trust. Remove the CA from devices when retired.
5. Start the server and keep the terminal open:

       node server.js 192.168.1.50

6. On the OBS computer open http://127.0.0.1:8080. Allow the server and OBS through the firewall on the trusted production network. Phones use HTTPS on TCP 8443 and direct WebRTC media uses negotiated UDP ports. Leave router port forwarding off. The dashboard listens on loopback only. Use a dedicated LAN without VPN routing if production traffic must remain physically isolated.
7. Select Phone camera, enter a name, and choose Create source. Select Show QR and scan the code on the phone and select Go live. Accept camera permission. The microphone starts muted. Choose one audio source for the room to avoid echo. Stop the camera before changing lens.
8. Click Copy OBS URL. In OBS select Sources > + > Browser, paste the URL, and set 1280 by 720. Reuse that existing source across scenes. Leave “Shutdown source when not visible” off if the feed should stay warm. Keep the camera links private. Slots persist in slots.json across server restarts.
9. To add an online camera, select Remote guest, send its join link to the guest and add its OBS URL as a separate Browser Source. The guest starts their camera on VDO.Ninja. This provides a one-way contribution feed. Use a separate call with headphones if the speaker needs two-way conversation.
10. Start local recording in OBS. For a public broadcast, configure OBS Settings > Stream for the event destination, then start streaming. Recording and streaming are separate controls.

## Rehearsal

Disconnect the router WAN before opening either local link. Join two phones, add each source in OBS, verify video and one selected microphone on a short recording, and reopen one phone with its original link. Reconnect the WAN, add a remote guest using mobile data or another network, then test an unlisted broadcast. Disconnect WAN again and confirm that local footage is still being recorded. Test on your actual phones and OBS installation.

If the phone cannot open the page, check the private IP, firewall, certificate trust and Wi-Fi isolation. If the phone reports ready but OBS stays black, verify you pasted the OBS URL and that no other viewer has taken the slot. Preview the same URL on the OBS PC with the browser closed again before retrying OBS. If the IP changes, generate a certificate for the new address, relaunch with it, and update the local links. QR generation runs locally. Internet loss affects remote feeds and streaming.

Downloads and references: obsproject.com/download, nodejs.org, github.com/FiloSottile/mkcert, docs.vdo.ninja. The bundled QR encoder credits and license are in vendor.

## Multiple phones and laptop screens

Create a separate named slot for every simultaneous source. For example, add local cameras for Wide and Podium, then choose Laptop screen for Slides. Give each device its own join link and paste each matching OBS URL into its own Browser Source. Reuse existing sources when creating different OBS scenes.

On each presenting laptop, join the production LAN and trust the same public rootCA.pem described above. Open its join link in a desktop browser, click Share screen and choose the display, application window or browser tab. Select the actual slideshow window for presenter-view setups. To include presentation sound, select audio in the browser picker if offered, then click Enable shared audio. Availability depends on the browser, OS and selected surface. Stopping the share releases capture. Click Share screen again to resume using the same OBS source.

Use a 1920 by 1080 OBS Browser Source for full-HD slides if appropriate. Rehearse all cameras and screens together to check text readability, frame drops and Wi-Fi capacity. The previous local camera and remote guest links still work when you reuse the same slots.json, certificates and server IP.

The Source studio dashboard shows Device ready when a local device is publishing and Viewer connected when it reports an established WebRTC connection. Remote guest status is checked in OBS.

## Director room

Open the dashboard on the OBS computer to see the multiview. Each phone and laptop sends a silent JPEG preview approximately every three seconds while capturing. The director sees the latest image at the next dashboard refresh. These previews stay in server memory, expire after eight seconds without a fresh image, and use a separate path from the full-motion OBS viewer. Reload existing sender pages after updating.

Choose **Enlarge** on a tile to inspect it or use **Show** to filter by device type. For remote guests, **Preview guest** opens a silent VDO.Ninja viewer on demand. **Close preview** releases that guest connection. Local viewer status indicates a WebRTC viewer connection. Use OBS to confirm which scene is on air and to mix audio.

Choose **Remove** on a tile and confirm the source name to remove it from the saved Director room. Local join and viewer links expire. For a remote guest, removal closes the director preview while the external VDO.Ninja link remains usable. OBS scene entries are managed in OBS.

## Production controls

Reload the director dashboard, local sender pages and OBS Browser Sources after updating. Rename and Move up/down operate on the saved source order, including when a filter is active. Links are stable. Each local tile shows the age of the last device contact and preview, capture dimensions, and a device-side audio meter when audio is enabled. Viewer receiving video means the viewer recently reported advancing frames. OBS recording and its mixer remain the reference for final output.

Use Live preview to open one silent full-motion feed. Local previews use an independent WebRTC connection. Selecting another preview closes the previous one. A failed preview can be closed and reopened without refreshing OBS. Each phone offers 480p, 720p or 1080p before or during capture. The device negotiates the closest supported dimensions, shown on its director tile.

Local OBS Browser Sources relay the OBS source-active event to the phone and director (typically within a few seconds). ON AIR denotes OBS program activity, including a scene transition; it does not indicate a public stream is running. If no OBS event has arrived, the display reads Tally unavailable. Switch away and back during rehearsal to initialize tally. Keep Shutdown source when not visible off for standby reporting. The tally and device telemetry apply to local sources. Public VDO.Ninja guests use their own viewer.
