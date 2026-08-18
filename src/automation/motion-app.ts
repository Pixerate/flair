import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export class MotionAppAutomation {
  private motionPath: string;

  constructor(motionPath = '/Applications/Motion.app') {
    this.motionPath = motionPath;
  }

  /**
   * Checks whether Apple Motion is installed on the local macOS system.
   */
  public isInstalled(): boolean {
    return fs.existsSync(this.motionPath);
  }

  /**
   * Checks whether the Motion.app process is currently running on macOS.
   */
  public async isMotionRunning(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('pgrep -x "Motion"');
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Gracefully quits Motion.app if running.
   */
  public async quitMotion(): Promise<void> {
    if (await this.isMotionRunning()) {
      const appleScript = 'tell application "Motion" to quit';
      const command = `osascript -e ${JSON.stringify(appleScript)}`;
      try {
        await execAsync(command);
      } catch {
        // Fallback kill if graceful quit blocked by dialog
        await execAsync('pkill -x "Motion"').catch(() => {});
      }
    }
  }

  /**
   * Opens the specified Apple Motion project file (.motn) in Motion.app.
   * 
   * @param projectPath Absolute file path to the .motn project file.
   */
  public async openProject(projectPath: string): Promise<void> {
    const fullPath = path.resolve(process.cwd(), projectPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Motion project file does not exist at: ${fullPath}`);
    }

    if (!this.isInstalled()) {
      throw new Error(`Apple Motion is not installed at expected location: ${this.motionPath}`);
    }

    const command = `open -a "${this.motionPath}" "${fullPath}"`;
    await execAsync(command);
  }

  /**
   * Focuses Motion.app and triggers timeline playback via Spacebar key event.
   */
  public async playTimeline(): Promise<void> {
    const lines = [
      'tell application "System Events"',
      '  tell process "Motion"',
      '    set frontmost to true',
      '    delay 0.5',
      '    key code 49',
      '  end tell',
      'end tell',
    ];

    const args = lines.map((l) => `-e ${JSON.stringify(l)}`).join(' ');
    const command = `osascript ${args}`;
    await execAsync(command);
  }

  /**
   * Instructs Motion.app to render the project file to an MP4 video output.
   * 
   * @param projectPath Path to input .motn project file.
   * @param outputPath Path to destination rendered MP4 file.
   */
  public async renderProject(projectPath: string, outputPath: string): Promise<void> {
    const absProjectPath = path.resolve(process.cwd(), projectPath);
    const absOutputPath = path.resolve(process.cwd(), outputPath);

    if (!fs.existsSync(absProjectPath)) {
      throw new Error(`Input Motion file not found at: ${absProjectPath}`);
    }

    // Open project in Motion
    await this.openProject(absProjectPath);
    await new Promise((res) => setTimeout(res, 2000));

    // Ensure Motion is active and trigger Export Movie dialog
    const outputDir = path.dirname(absOutputPath);
    const outputExt = path.extname(absOutputPath);
    const outputFilename = path.basename(absOutputPath, outputExt);

    const scriptLines = [
      'tell application "Motion" to activate',
      'delay 1.0',
      'tell application "System Events"',
      '  tell process "Motion"',
      '    try',
      '      click menu item "Export Movie (default)…" of menu of menu item "Share" of menu "File" of menu bar item "File" of menu bar 1',
      '    on error',
      '      keystroke "e" using {command down}',
      '    end try',
      '    delay 1.5',
      '    if exists button "Next…" of window 1 then',
      '      click button "Next…" of window 1',
      '      delay 1.5',
      '    end if',
      '    if exists sheet 1 of window 1 then',
      '      keystroke "g" using {command down, shift down}',
      '      delay 1.0',
      `      keystroke ${JSON.stringify(outputDir)}`,
      '      delay 1.0',
      '      key code 36',
      '      delay 1.0',
      `      set value of text field 1 of sheet 1 of window 1 to ${JSON.stringify(outputFilename)}`,
      '      delay 0.5',
      '      click button "Save" of sheet 1 of window 1',
      '    end if',
      '  end tell',
      'end tell',
    ];

    const args = scriptLines.map((l) => `-e ${JSON.stringify(l)}`).join(' ');
    const command = `osascript ${args}`;
    await execAsync(command);

    // Wait for output video file to be rendered to disk
    let pollCount = 30; // Wait up to 30s
    while (pollCount > 0) {
      if (fs.existsSync(absOutputPath)) {
        const stat = fs.statSync(absOutputPath);
        if (stat.size > 100000) {
          console.log(`✅ Rendered video verified at: ${absOutputPath} (${stat.size} bytes)`);
          return;
        }
      }
      await new Promise((res) => setTimeout(res, 1000));
      pollCount--;
    }

    throw new Error(`Rendered video file was not found at expected location after rendering: ${absOutputPath}`);
  }
}
