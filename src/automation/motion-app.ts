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

    // Trigger Export Movie dialog via AppleScript shortcut Cmd+E
    const scriptLines = [
      'tell application "System Events"',
      '  tell process "Motion"',
      '    set frontmost to true',
      '    delay 1.0',
      '    keystroke "e" using {command down}',
      '    delay 1.0',
      '    key code 36', // Press Enter to confirm preset
      '    delay 1.0',
      '    keystroke "g" using {command down, shift down}', // Go to folder in save sheet
      '    delay 0.5',
      `    keystroke ${JSON.stringify(path.dirname(absOutputPath))}`,
      '    delay 0.5',
      '    key code 36',
      '    delay 0.5',
      '    key code 36', // Save file
      '  end tell',
      'end tell',
    ];

    const args = scriptLines.map((l) => `-e ${JSON.stringify(l)}`).join(' ');
    const command = `osascript ${args}`;
    await execAsync(command);
  }
}
