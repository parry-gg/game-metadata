import fs from 'fs';
import path from 'path';

const STAGE_ICON_DIR = '/Users/grantwarman/code/StreamHelperAssets/games/ssbu/stage_icon';
const OUTPUT_DIR = '/Users/grantwarman/Code/game-metadata/games/super-smash-bros-ultimate/stages';

// Stage name mappings from internal names to display names
const stageNameMap: Record<string, string> = {
  '75m': '75m',
  'Animal_City': 'Town and City',
  'Animal_Island': 'Tortimer Island',
  'Animal_Village': 'Smashville',
  'BalloonFight': 'Balloon Fight',
  'BattleField': 'Battlefield',
  'BattleFieldL': 'Big Battlefield',
  'BattleFieldS': 'Small Battlefield',
  'BattleField_pre-v8.1': 'Battlefield (Pre v8.1)',
  'Bayo_Clock': 'Umbra Clock Tower',
  'Brave_Altar': 'Yggdrasil\'s Altar',
  'Buddy_Spiral': 'Spiral Mountain',
  'DK_Jungle': 'Kongo Jungle',
  'DK_Lodge': 'Jungle Japes',
  'DK_WaterFall': 'Kongo Falls',
  'Demon_Dojo': 'Mishima Dojo',
  'Dolly_Stadium': 'King of Fighters Stadium',
  'Dracula_Castle': 'Dracula\'s Castle',
  'DuckHunt': 'Duck Hunt',
  'End': 'Final Destination',
  'FE_Arena': 'Arena Ferox',
  'FE_Colloseum': 'Coliseum',
  'FE_Shrine': 'Garreg Mach Monastery',
  'FE_Siege': 'Castle Siege',
  'FF_Cave': 'Northern Cave',
  'FF_Midgar': 'Midgar',
  'FlatZoneX': 'Flat Zone X',
  'Fox_Corneria': 'Corneria',
  'Fox_LylatCruise': 'Lylat Cruise',
  'Fox_Venom': 'Venom',
  'Fzero_Bigblue': 'Big Blue',
  'Fzero_Mutecity3DS': 'Mute City SNES',
  'Fzero_Porttown': 'Port Town Aero Dive',
  'HomerunContest': 'Home-Run Contest',
  'Icarus_Angeland': 'Skyworld',
  'Icarus_SkyWorld': 'Palutena\'s Temple',
  'Icarus_Uprising': 'Reset Bomb Forest',
  'Ice_Top': 'Summit',
  'Jack_Mementoes': 'Mementos',
  'Kart_CircuitFor': 'Figure-8 Circuit',
  'Kart_CircuitX': 'Mario Circuit',
  'Kirby_Cave': 'The Great Cave Offensive',
  'Kirby_Fountain': 'Fountain of Dreams',
  'Kirby_Gameboy': 'Dream Land GB',
  'Kirby_Greens': 'Green Greens',
  'Kirby_Halberd': 'Halberd',
  'Kirby_Pupupu64': 'Dream Land',
  'LuigiMansion': 'Luigi\'s Mansion',
  'MG_Shadowmoses': 'Shadow Moses Island',
  'MarioBros': 'Mario Bros.',
  'Mario_3DLand': 'Super Mario 3D Land',
  'Mario_Castle64': 'Peach\'s Castle',
  'Mario_CastleDx': 'Princess Peach\'s Castle',
  'Mario_Dolpic': 'Delfino Plaza',
  'Mario_Galaxy': 'Mario Galaxy',
  'Mario_Maker': 'Super Mario Maker',
  'Mario_NewBros2': 'Golden Plains',
  'Mario_Odyssey': 'New Donk City Hall',
  'Mario_Paper': 'Paper Mario',
  'Mario_Past64': 'Mushroom Kingdom',
  'Mario_PastUsa': 'Mushroom Kingdom II',
  'Mario_PastX': 'Mushroomy Kingdom',
  'Mario_Rainbow': 'Rainbow Cruise',
  'Mario_Uworld': 'Mushroom Kingdom U',
  'MenuMusic': 'Menu Music',
  'Metroid_Kraid': 'Brinstar Depths',
  'Metroid_Norfair': 'Norfair',
  'Metroid_Orpheon': 'Frigate Orpheon',
  'Metroid_ZebesDx': 'Brinstar',
  'Mother_Fourside': 'Fourside',
  'Mother_Magicant': 'Magicant',
  'Mother_Newpork': 'New Pork City',
  'Mother_Onett': 'Onett',
  'NintenDogs': 'Living Room',
  'Pac_Land': 'Pac-Land',
  'Pickel_World': 'Minecraft World',
  'Pictochat2': 'PictoChat 2',
  'Pikmin_Garden': 'Garden of Hope',
  'Pikmin_Planet': 'Distant Planet',
  'Pilotwings': 'Pilotwings',
  'Plankton': 'Hanenbow',
  'Poke_Kalos': 'Kalos Pokémon League',
  'Poke_Stadium': 'Pokémon Stadium',
  'Poke_Stadium2': 'Pokémon Stadium 2',
  'Poke_Tengam': 'Spear Pillar',
  'Poke_Tower': 'Prism Tower',
  'Poke_Unova': 'Unova Pokémon League',
  'Poke_Yamabuki': 'Saffron City',
  'PunchOutSB': 'Boxing Ring',
  'PunchOutW': 'Boxing Ring (Punch-Out!!)',
  'Random': 'Random',
  'RandomNormal': 'Random (Normal)',
  'Random_pre-v8.1': 'Random (Pre v8.1)',
  'Rock_Wily': 'Wily Castle',
  'SF_Suzaku': 'Suzaku Castle',
  'SP_Edit': 'Stage Builder',
  'SP_Edit_pre-v8.1': 'Stage Builder (Pre v8.1)',
  'Sonic_Greenhill': 'Green Hill Zone',
  'Sonic_Windyhill': 'Windy Hill Zone',
  'Spla_Parking': 'Moray Towers',
  'StreetPass': 'Find Mii',
  'Tantan_Spring': 'Spring Stadium',
  'Tantan_Spring_pre-v8.1': 'Spring Stadium (Pre v8.1)',
  'Tomodachi': 'Tomodachi Life',
  'Trail_Castle': 'Hollow Bastion',
  'Training': 'Training',
  'Wario_Gamer': 'Gamer',
  'Wario_Madein': 'WarioWare, Inc.',
  'WiiFit': 'Wii Fit Studio',
  'WreckingCrew': 'Wrecking Crew',
  'WufuIsland': 'Wuhu Island',
  'Xeno_Alst': 'Cloud Sea of Alrest',
  'Xeno_Gaur': 'Gaur Plain',
  'Yoshi_CartBoard': 'Woolly World',
  'Yoshi_Island': 'Yoshi\'s Island',
  'Yoshi_Story': 'Yoshi\'s Story',
  'Yoshi_Yoster': 'Super Happy Tree',
  'Zelda_Gerudo': 'Gerudo Valley',
  'Zelda_Greatbay': 'Great Bay',
  'Zelda_Hyrule': 'Hyrule Castle',
  'Zelda_Oldin': 'Bridge of Eldin',
  'Zelda_Pirates': 'Pirate Ship',
  'Zelda_Skyward': 'Skyloft',
  'Zelda_Temple': 'Temple',
  'Zelda_Tower': 'Great Plateau Tower',
  'Zelda_Train': 'Spirit Train'
};

interface Stage {
  name: string;
  variants: Array<{
    images: {
      thumbnail: string;
    };
  }>;
}

// Read all PNG files from the stage icon directory
const files = fs.readdirSync(STAGE_ICON_DIR)
  .filter(f => f.endsWith('.png') && f.startsWith('stage_2_') && f !== 'stage_2_Random.png');

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Generate JSON files for each stage
for (const file of files) {
  const match = file.match(/stage_2_(.+)\.png/);
  if (!match) continue;

  const internalName = match[1];
  const displayName = stageNameMap[internalName] || internalName;

  const stage: Stage = {
    name: displayName,
    variants: [
      {
        images: {
          thumbnail: `../StreamHelperAssets/games/ssbu/stage_icon/${file}`
        }
      }
    ]
  };

  // Use kebab-case for filename
  const filename = displayName.toLowerCase()
    .replace(/['']/g, '')
    .replace(/[&]/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const outputPath = path.join(OUTPUT_DIR, `${filename}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(stage, null, 2) + '\n');

  console.log(`Created ${filename}.json`);
}

console.log(`\nGenerated ${files.length} stage files`);
