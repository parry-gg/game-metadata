#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";

/**
 * Upload Assets to Parry.gg Image Service
 *
 * This script uploads local image files to the Parry.gg image upload service,
 * which stores them on Bunny.net CDN. It then updates the JSON metadata files
 * to reference the CDN URLs instead of local file paths.
 *
 * Usage:
 *   npx ts-node scripts/upload-assets.ts [--dry-run] [--game GAME_SLUG]
 *
 * Environment Variables:
 *   PARRY_API_KEY: API key for the Parry.gg image service (required)
 *   PARRY_API_URL: Override the API base URL (default: http://api.parry.gg)
 */

interface UploadResponse {
  imageUrl: string;
}

interface CharacterVariant {
  metadata: Record<string, string | undefined>;
  images: {
    stock_icon?: string;
    portrait?: string;
  };
}

interface CharacterData {
  name: string;
  variants: CharacterVariant[];
}

interface StageData {
  name: string;
  metadata?: Record<string, unknown>;
  images: {
    thumbnail?: string;
  };
}

const DEFAULT_API_BASE_URL = "https://api.parry.gg";
const GAMES_DIR = path.join(process.cwd(), "games");

class AssetUploader {
  private apiKey: string;
  private apiBaseUrl: string;
  private dryRun: boolean;
  private gameFilter?: string;
  private uploadedMap: Map<string, string> = new Map();

  constructor(dryRun = false, gameFilter?: string) {
    this.apiKey = process.env.PARRY_API_KEY || "";
    if (!this.apiKey && !dryRun) {
      throw new Error(
        'PARRY_API_KEY environment variable is not set. Set it before running this script.'
      );
    }
    this.apiBaseUrl = process.env.PARRY_API_URL || DEFAULT_API_BASE_URL;
    this.dryRun = dryRun;
    this.gameFilter = gameFilter;
  }

  private async uploadFile(filePath: string): Promise<string> {
    // Check if already uploaded
    if (this.uploadedMap.has(filePath)) {
      console.log(`  ↻ Already uploaded: ${filePath}`);
      return this.uploadedMap.get(filePath)!;
    }

    const fileName = path.basename(filePath);
    console.log(`  ⬆ Uploading: ${fileName}`);

    if (this.dryRun) {
      const mockUrl = `https://cdn.parry.gg/${filePath}`;
      this.uploadedMap.set(filePath, mockUrl);
      return mockUrl;
    }

    try {
      const fileBuffer = fs.readFileSync(filePath);

      const response = await fetch(`${this.apiBaseUrl}/images`, {
        method: "POST",
        headers: {
          "X-API-KEY": this.apiKey,
          "Content-Type": "application/octet-stream",
          "Accept": "application/json",
        },
        body: new Uint8Array(fileBuffer),
      });

      if (!response.ok) {
        throw new Error(
          `Upload failed with status ${response.status}: ${response.statusText}`
        );
      }

      const data = (await response.json()) as UploadResponse;
      const cdnUrl = data.imageUrl;
      if(!cdnUrl) {
        throw new Error(
          `Upload completed but could not find url`
        );
      }
      this.uploadedMap.set(filePath, cdnUrl);
      console.log(`  ✓ Uploaded to: ${cdnUrl}`);
      return cdnUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ Upload failed: ${message}`);
      throw error;
    }
  }

  private isLocalPath(str: string): boolean {
    return str.startsWith("./") || str.startsWith("../") || !str.startsWith("http");
  }

  private async processCharacterFile(filePath: string): Promise<void> {
    const characterName = path.basename(filePath, ".json");
    console.log(`\nProcessing character: ${characterName}`);

    const rawData = fs.readFileSync(filePath, "utf-8");
    const character = JSON.parse(rawData) as CharacterData;

    let modified = false;

    for (const variant of character.variants) {
      // Process all image URLs in the images object
      for (const [imageKey, imageUrl] of Object.entries(variant.images)) {
        if (imageUrl && this.isLocalPath(imageUrl)) {
          // Resolve paths relative to the project root (where script is run from)
          const fullPath = path.resolve(process.cwd(), imageUrl);
          if (fs.existsSync(fullPath)) {
            const cdnUrl = await this.uploadFile(fullPath);
            (variant.images as Record<string, string>)[imageKey] = cdnUrl;
            modified = true;
          } else {
            console.warn(`  ⚠ File not found: ${fullPath}`);
          }
        }
      }
    }

    if (modified && !this.dryRun) {
      fs.writeFileSync(filePath, JSON.stringify(character, null, 2));
      console.log(`  ✓ Updated: ${characterName}.json`);
    } else if (modified && this.dryRun) {
      console.log(`  [DRY RUN] Would update: ${characterName}.json`);
    }
  }

  private async processStageFile(filePath: string): Promise<void> {
    const stageName = path.basename(filePath, ".json");
    console.log(`\nProcessing stage: ${stageName}`);

    const rawData = fs.readFileSync(filePath, "utf-8");
    const stage = JSON.parse(rawData) as StageData;

    let modified = false;

    // Process all image URLs in the images object
    for (const [imageKey, imageUrl] of Object.entries(stage.images)) {
      if (imageUrl && this.isLocalPath(imageUrl)) {
        // Resolve paths relative to the project root (where script is run from)
        const fullPath = path.resolve(process.cwd(), imageUrl);
        if (fs.existsSync(fullPath)) {
          const cdnUrl = await this.uploadFile(fullPath);
          (stage.images as Record<string, string>)[imageKey] = cdnUrl;
          modified = true;
        } else {
          console.warn(`  ⚠ File not found: ${fullPath}`);
        }
      }
    }

    if (modified && !this.dryRun) {
      fs.writeFileSync(filePath, JSON.stringify(stage, null, 2));
      console.log(`  ✓ Updated: ${stageName}.json`);
    } else if (modified && this.dryRun) {
      console.log(`  [DRY RUN] Would update: ${stageName}.json`);
    }
  }

  private async processGame(gameDir: string, gameName: string): Promise<void> {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Game: ${gameName}`);
    console.log(`${"=".repeat(60)}`);

    const charactersDir = path.join(gameDir, "characters");
    const stagesDir = path.join(gameDir, "stages");

    // Process characters
    if (fs.existsSync(charactersDir)) {
      const characterFiles = fs
        .readdirSync(charactersDir)
        .filter((f) => f.endsWith(".json"));

      for (const file of characterFiles) {
        const filePath = path.join(charactersDir, file);
        await this.processCharacterFile(filePath);
      }
    }

    // Process stages
    if (fs.existsSync(stagesDir)) {
      const stageFiles = fs
        .readdirSync(stagesDir)
        .filter((f) => f.endsWith(".json"));

      for (const file of stageFiles) {
        const filePath = path.join(stagesDir, file);
        await this.processStageFile(filePath);
      }
    }
  }

  async run(): Promise<number> {
    try {
      if (this.dryRun) {
        console.log("🔍 DRY RUN MODE - No files will be uploaded or modified\n");
      }

      if (!fs.existsSync(GAMES_DIR)) {
        console.error(`Error: Games directory not found: ${GAMES_DIR}`);
        return 1;
      }

      const games = fs.readdirSync(GAMES_DIR).filter((f) => {
        const fullPath = path.join(GAMES_DIR, f);
        return fs.statSync(fullPath).isDirectory();
      });

      if (games.length === 0) {
        console.log("No games found in games directory.");
        return 0;
      }

      for (const game of games) {
        if (this.gameFilter && game !== this.gameFilter) {
          continue;
        }

        const gameDir = path.join(GAMES_DIR, game);
        await this.processGame(gameDir, game);
      }

      console.log(`\n${"=".repeat(60)}`);
      console.log("✓ Upload process completed");
      console.log(`${"=".repeat(60)}`);
      return 0;
    } catch (error) {
      console.error("Error during upload process:", error);
      return 1;
    }
  }
}

function main(): number {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const gameIndex = args.indexOf("--game");
  const gameFilter = gameIndex !== -1 ? args[gameIndex + 1] : undefined;

  console.log("\n🎮 Game Metadata Asset Uploader");
  console.log("================================\n");

  if (dryRun) {
    console.log("Mode: Dry Run (no changes will be made)");
  }
  if (gameFilter) {
    console.log(`Game Filter: ${gameFilter}`);
  }
  const apiUrl = process.env.PARRY_API_URL || DEFAULT_API_BASE_URL;
  console.log(`API URL: ${apiUrl}`);
  console.log();

  const uploader = new AssetUploader(dryRun, gameFilter);
  uploader.run().then((code) => process.exit(code));
  return 0;
}

main();
