# Parry.gg Game Metadata Repository

A community-sourced database of game metadata (characters and stages) for the [Parry.gg](https://parry.gg) tournament platform. This repository stores structured JSON data for fighting game characters and stages, with images hosted on the Bunny.net CDN.

## Quick Start

### Project Structure

```
├── .gitignore                  # Binary file exclusion rules
├── LICENSE                     # MIT License
├── README.md                   # This file
├── tsconfig.json               # TypeScript configuration
├── package.json                # Node.js dependencies
├── scripts/
│   ├── .gitkeep
│   └── upload-assets.ts        # Asset upload tool
└── games/
    └── [game-slug]/
        ├── characters/
        │   └── [character-slug].json
        └── stages/
            └── [stage-slug].json
            └── stock-icons/    # Local image directory (referenced in JSON)
```

### Naming Convention

All folders and filenames use **kebab-case** to ensure compatibility across operating systems:

✅ Correct:
- `super-smash-bros-ultimate/`
- `king-k-rool.json`
- `stock-icons/` folder
- `neutral-variant.png` file

❌ Incorrect:
- `SuperSmashBrosUltimate/`
- `KingKRool.json`
- `Stock Icons/` folder
- `NeutralVariant.png` file

## Data Format

All game metadata is stored as JSON with UTF-8 encoding. **No binary files are committed to this repository.** Images are referenced via CDN URLs or local paths during development.

### Character Schema

Each character gets a separate JSON file in `games/[game]/characters/[character].json`:

```json
{
  "name": "Mario",
  "variants": [
    {
      "images": {
        "stock_icon": "https://cdn.parry.gg/ssbu/mario/neutral-stock.webp"
      }
    },
    {
      "metadata": {
        "color": "red",
        "outfit": "builder"
      },
      "images": {
        "stock_icon": "https://cdn.parry.gg/ssbu/mario/red-stock.webp",
        "portrait": "https://cdn.parry.gg/ssbu/mario/red-portrait.webp"
      }
    }
  ]
}
```

#### Field Descriptions

- **name** (string, required): Canonical character name
- **variants** (array, required): Array of character variant objects
  - **metadata** (object, optional): Game-specific metadata for this variant
    - Omit entirely for the neutral/default variant (or use empty `{}`)
    - Can include: `color`, `outfit`, `unlock_condition`, etc.
  - **images** (object, required): Image URLs for the variant
    - **stock_icon** (string, optional): Small icon used in selection screens
    - **portrait** (string, optional): Large detailed character image
    - Both should use CDN URLs (`https://...`) in production

### Stage Schema

Each stage gets a separate JSON file in `games/[game]/stages/[stage].json`:

```json
{
  "name": "Battlefield",
  "metadata": {
    "stage_type": "starter",
    "availability": "base_game",
    "is_legal": true
  },
  "images": {
    "thumbnail": "./stock-icons/battlefield-thumb.png",
    "banner": "https://cdn.parry.gg/ssbu/stages/battlefield-banner.webp"
  }
}
```

#### Field Descriptions

- **name** (string, required): Canonical stage name
- **metadata** (object, optional): Stage-specific metadata
  - Can include: `stage_type`, `availability`, `is_legal`, `tournament_legality`, etc.
- **images** (object, required): Image URLs for the stage
  - **thumbnail** (string, optional): Small square image
  - **banner** (string, optional): Larger banner image
  - Both can be local paths or CDN URLs

## Managing Assets

### Local Development

During development, reference local image files with relative paths:

```json
"stock_icon": "./stock-icons/character-name.png"
```

Images should be organized in `games/[game]/stock-icons/` or similar subdirectories.

### Uploading to CDN

Use the `upload-assets.ts` script to upload all local images to the Parry.gg image service, which stores them on Bunny.net CDN. The script then updates all JSON files with CDN URLs.

#### Prerequisites

1. Node.js 16+ installed
2. npm dependencies installed: `npm install`
3. API key for the Parry.gg image service

#### Basic Usage

**Dry run (preview what will happen):**

```bash
npx ts-node scripts/upload-assets.ts --dry-run
```

**Upload specific game:**

```bash
npx ts-node scripts/upload-assets.ts --dry-run --game super-smash-bros-melee
PARRY_API_KEY=your_api_key npx ts-node scripts/upload-assets.ts --game super-smash-bros-melee
```

**Upload all games:**

```bash
PARRY_API_KEY=your_api_key npx ts-node scripts/upload-assets.ts
```

#### Environment Variables

- **PARRY_API_KEY** (required): API key for image upload service
- **PARRY_API_URL** (optional): Override API endpoint
  - Default: `http://api.parry.gg`
  - Example for testing: `PARRY_API_URL=http://localhost:3000 npx ts-node scripts/upload-assets.ts --dry-run`

#### Command Line Options

- `--dry-run`: Preview changes without uploading or modifying files
- `--game GAME_SLUG`: Process only a specific game (e.g., `super-smash-bros-melee`)

## Contributing

### Adding a New Game

1. Create a directory in `games/[game-slug]/` (use kebab-case)
2. Create subdirectories: `characters/` and `stages/`
3. Add JSON files for each character and stage

Example:

```bash
mkdir -p games/tekken-8/characters
mkdir -p games/tekken-8/stages
mkdir -p games/tekken-8/stock-icons
```

### Adding Characters

1. Create `games/[game]/characters/[character-slug].json`
2. Include at least one variant (the default without metadata)
3. Reference images either locally or via CDN URLs

Example:

```bash
cat > games/tekken-8/characters/kazuya.json << 'EOF'
{
  "name": "Kazuya Mishima",
  "variants": [
    {
      "images": {
        "stock_icon": "./stock-icons/kazuya-neutral.png"
      }
    }
  ]
}
EOF
```

### Adding Stages

1. Create `games/[game]/stages/[stage-slug].json`
2. Include metadata relevant to your game
3. Reference stage images

### Image Organization

Store images locally in `games/[game]/stock-icons/` or similar:

```
games/[game]/stock-icons/
├── character-name-neutral.png
├── character-name-blue.png
├── character-name-red.png
└── stage-name-thumb.png
```

**Important:** Use kebab-case for all image filenames to avoid case sensitivity issues.

### Before Committing

1. Validate your JSON files are valid JSON (use [jsonlint.com](https://jsonlint.com))
2. Ensure all image paths are correct (use relative paths for local files)
3. Test with dry-run: `npx ts-node scripts/upload-assets.ts --dry-run`
4. Do NOT commit image files - they should not appear in git history

## Workflow: From Local Images to CDN

### Step 1: Create metadata with local paths

```json
{
  "name": "Ryu",
  "variants": [
    {
      "images": {
        "stock_icon": "./stock-icons/ryu-neutral.png"
      }
    }
  ]
}
```

### Step 2: Place image files in stock-icons directory

```
games/street-fighter-6/stock-icons/
└── ryu-neutral.png
```

### Step 3: Test upload with dry-run

```bash
npx ts-node scripts/upload-assets.ts --game street-fighter-6 --dry-run
```

Output:
```
Processing character: ryu
  ⬆ Uploading: ryu-neutral.png
  ✓ Uploaded to: https://parrygg-dev.b-cdn.net/...
  [DRY RUN] Would update: ryu.json
```

### Step 4: Upload for real

```bash
PARRY_API_KEY=your_key npx ts-node scripts/upload-assets.ts --game street-fighter-6
```

Your JSON files now reference CDN URLs:

```json
{
  "name": "Ryu",
  "variants": [
    {
      "images": {
        "stock_icon": "https://parrygg-dev.b-cdn.net/abc123def456.png"
      }
    }
  ]
}
```

### Step 5: Commit

```bash
git add games/street-fighter-6/characters/ryu.json
git commit -m "Add Ryu character metadata for Street Fighter 6"
```

## Development

### Local Setup

```bash
# Install dependencies
npm install

# Compile TypeScript (optional)
npx tsc

# Run scripts
npx ts-node scripts/upload-assets.ts --help
```

### TypeScript Configuration

The `tsconfig.json` is configured for Node.js targeting ES2020:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true
  }
}
```

## Support

- Open an issue for bugs or feature requests
- See [Parry.gg](https://parry.gg) for the tournament platform
- Questions? Open a discussion in the repository

---

## Legal Disclaimer and Fair Use

**Game Assets Intellectual Property Notice:**

This repository references and catalogs intellectual property owned by Nintendo, Bandai Namco, Capcom, SNK, and other game publishers. This project is **not affiliated with, endorsed by, or associated with** any of these companies.

### Fair Use Justification

The use of game character names, images, and metadata in this project is protected under fair use doctrine for the following reasons:

1. **Transformative Purpose**: This repository transforms original game assets into structured metadata for competitive esports tournament organization. The metadata serves a fundamentally different purpose than the original commercial game products—it enables community-driven tournament administration rather than entertainment or commercial competition.

2. **Limited Use**:
   - Only necessary stock images and character selection icons are included, not complete game content
   - Metadata is minimal and focused on competitive relevance
   - Images are downsampled and optimized for tournament platform use
   - No gameplay footage, music, or complete artistic works are included

3. **No Commercial Competition**:
   - This project does not compete with or substitute for the original games
   - It supports and enhances the competitive community around these games
   - Revenue from the Parry.gg platform does not come from the use of these assets
   - The project is explicitly non-commercial in nature

4. **Educational and Community Benefit**:
   - Enables competitive players to organize and participate in tournaments
   - Preserves and documents game history and competitive scenes
   - Serves the esports community and casual fans equally
   - No payment is required to access or use this metadata

5. **Nominal Impact on Market**:
   - Use of images in a tournament platform does not diminish the commercial value of the original games
   - Does not prevent or interfere with publishers' ability to monetize their intellectual property
   - Actually drives interest in and engagement with the original games

### Copyright Attribution

Where possible, this repository includes attribution to the original copyright holders through game names and character identifications. All character and stage names are presented as owned by their respective copyright holders.

### Removal Requests

If you are a copyright holder and believe any content in this repository infringes on your intellectual property rights, or if you would like your assets removed from the Parry.gg CDN, please contact us immediately. We respect intellectual property rights and will respond promptly to removal requests.

## Contributing and Legal Responsibility

By contributing to this repository, you agree that:

- You have the right to contribute the metadata you submit
- Your JSON contributions are licensed under the MIT License
- You will not submit copyrighted game assets beyond fair use scope
- You understand this project relies on fair use protections
- You take responsibility for any images you upload
- You will respect removal requests from copyright holders

Contributors are encouraged to:
- Use only official game assets (from game clients, official media, or authorized sources)
- Compress and optimize images to minimize storage and bandwidth
- Document the source of assets where possible
- Err on the side of caution when unsure about fair use

## License

This repository is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

### Clarification on License Scope

The MIT License applies to:
- All JSON metadata files in this repository
- All TypeScript and JavaScript code in the `scripts/` directory
- Repository infrastructure and documentation

The MIT License **does not apply to**:
- Game names, character names, and other protected intellectual property
- Character and stage images, which are owned by their respective publishers
- Game mechanics, lore, and other copyrighted game content

For game assets, see the [Fair Use](#fair-use-justification) section above.
