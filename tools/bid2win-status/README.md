# Bid2Win Computer Status: Setup

Shows **Available** or **In Use** on the Bid Dashboard, so nobody connects with Chrome Remote Desktop and kicks someone else off.
It runs on the dedicated Bid2Win computer (about 10 minutes to set up) and needs nothing else installed.

## What it sends
Only three things: this computer's name, whether a Chrome Remote Desktop session is live (yes/no), and how many seconds since
the last keyboard/mouse activity. It does not look at the screen, keystrokes, files, or Bid2Win. It can't control the computer.

## Set up (on the dedicated computer, signed in as the Windows user that stays signed in)
1. Put `Bid2Win-RemoteStatus.ps1` in a folder, for example `C:\LRE`.
2. Open **Windows PowerShell** (Start menu, type "PowerShell"). You do not need "Run as administrator".
3. Allow the script in this window only, then go to the folder:
   ```
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   cd C:\LRE
   ```
4. **Check that it can tell when someone is connected** (important, do this before installing):
   - While nobody is connected (sit at that computer): `.\Bid2Win-RemoteStatus.ps1 -Learn -Label idle`
   - From another computer, connect with Chrome Remote Desktop. In that remote window open PowerShell, repeat step 3, then run:
     `.\Bid2Win-RemoteStatus.ps1 -Learn -Label connected`
   - In the two results, look at the line starting `Detection by program 'remoting_desktop'`.
     It should say **absent** when idle and **PRESENT** when connected. If it does, go on to step 5.
     If not, send both files (`bid2win-check-idle.txt` and `bid2win-check-connected.txt`, saved next to the script) so the check can be adjusted.
5. Install it (it will then start by itself every time that user signs in):
   ```
   .\Bid2Win-RemoteStatus.ps1 -Install
   ```
6. Open the Bid Dashboard. The **Bid2Win Computer** strip should say **Available** within about 30 seconds.
   Connect with Chrome Remote Desktop: it should change to **In Use** within about 10 to 30 seconds. Disconnect: back to **Available**.

## Good to know
- **Computer Offline** means the program has stopped reporting for a few minutes (computer off, asleep, signed out, or no internet).
  The dashboard then says it can't tell whether anyone is on it. Set the computer to never sleep, or Chrome Remote Desktop can't connect either.
- After a restart the program starts when that Windows user signs in. If the computer restarts and sits at the sign-in screen, set it to sign in automatically.
- It can't tell **who** is connected (everyone uses the same Google account), and it can't stop Chrome from disconnecting someone. It only warns people first.
- "Last Activity" comes from the computer's keyboard/mouse activity and is a best-effort extra. If it ever looks wrong, it can be removed without affecting In Use / Available.
- Its small log is at `%LOCALAPPDATA%\LRE\bid2win-status.log` (shows each time a session starts or ends, and any trouble reaching the database).

## Remove it
```
.\Bid2Win-RemoteStatus.ps1 -Uninstall
```
