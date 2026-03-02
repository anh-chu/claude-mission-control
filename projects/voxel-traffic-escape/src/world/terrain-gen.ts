import { ChunkData, CHUNK_SIZE } from "./chunk";
import { rand2, rand3, fbm, noise2D } from "./noise";

// ── Palette indices (from assets/palette.json) ──────────────────────
const ASPHALT = 1;
const ASPHALT_SHOULDER = 2;
const LANE_YELLOW = 3;
const LANE_WHITE = 4;
const CONCRETE = 5;
const CONCRETE_OVERPASS = 6;
const GUARDRAIL = 7;
const DIRT = 8;
const GRASS = 9;
const TREE_TRUNK = 10;
const TREE_LEAVES = 11;
const CONSTRUCTION_ORANGE = 12;
const CONSTRUCTION_YELLOW = 13;
const RUST = 14;

const CAR_COLORS = [41, 42, 43, 44, 45, 46, 47]; // red, blue, white, black, yellow, silver, green
const CAR_INTERIOR = 48;
const TIRE = 50;
const GLASS_WINDSHIELD = 51;

const BRICK_RED = 71;
const BRICK_BROWN = 72;
const WINDOW_GLASS = 73;
const WINDOW_FRAME = 74;
const DOOR_WOOD = 75;
const DOOR_METAL = 76;

const TUNNEL_BRICK = 101;
const TUNNEL_CONCRETE = 102;
const SEWER_WATER = 103;
const METAL_PIPE = 104;
const RUST_PIPE = 105;
const GRIME_MOSS = 106;
const ALGAE_GLOW = 107;

const WAFFLE_HOUSE_YELLOW = 121;
const WAFFLE_HOUSE_BROWN = 122;
const MARTA_BLUE = 123;
const FIRE_HYDRANT = 124;
const MAILBOX_BLUE = 125;

// Apartment interior palette (171-180)
const HARDWOOD_FLOOR = 171;
const BED_BLUE = 172;
const BED_PILLOW = 173;
const FURNITURE_DARK = 174;
const APPLIANCE_STEEL = 175;
const CARPET_RED = 176;
const COUCH_GREEN = 177;
const LAMP_WARM = 178;
const WELCOME_MAT = 179;
const APARTMENT_SIGN = 180;

// Street zone palette (131-152)
const STREET_LAMP_POLE = 131;
const STREET_LAMP_LIGHT = 132;
const TRAFFIC_LIGHT_HOUSING = 133;
const TRAFFIC_LIGHT_RED = 134;
const TRAFFIC_LIGHT_GREEN = 136;
const SIDEWALK_CONCRETE = 137;
const DRYWALL = 138;
const FLOOR_TILE = 139;
const STEEL_STRUCTURAL = 140;
const SCAFFOLDING = 141;
const BENCH_WOOD = 142;
const DUMPSTER_GREEN = 143;
const VARSITY_RED = 144;
const VARSITY_CREAM = 145;
const PARKING_CONCRETE = 146;
const SIGN_POST = 147;
const SIGN_GREEN = 148;
const AWNING_DARK = 150;
const COUNTER_TOP = 151;
const CRANE_YELLOW = 152;

// Underground zone palette (126-130, 161-164)
const MARTA_TRACK_RAIL = 126;
const MARTA_PLATFORM = 127;
const MARTA_TRAIN_BODY = 128;
const MARTA_TRAIN_STRIPE = 129;
const LADDER_RUNG = 130;
const MANHOLE_FRAME = 161;
const SUBWAY_TILE = 162;
const CAVE_CRYSTAL = 163;
const SEWER_GRATE_FLOOR = 164;

// ── World layout constants (in voxel coordinates) ───────────────────
// Player starts at wx=0, travels in +X direction.
// Ground level: world voxel Y = 8 (cy=0, local y=8)
const GROUND_Y = 8;

// Zone boundaries (world voxel X)
const ZONE1_END = 320;     // Highway ends
const COLLAPSE_START = 280; // Collapse begins
const COLLAPSE_END = 352;   // Collapse fully open
const ZONE3_START = 352;    // Streets begin
const APARTMENT_X = 576;    // Apartment building location
const WORLD_END = 640;      // End of generated world

// Highway dimensions (world voxel Z, centered on 0)
const ROAD_HALF_WIDTH = 16;   // 8 lanes total (4 each direction)
const SHOULDER_WIDTH = 4;
const HIGHWAY_HALF_WIDTH = ROAD_HALF_WIDTH + SHOULDER_WIDTH; // 20

// Underground dimensions
const TUNNEL_RADIUS = 5;
const SEWER_FLOOR_Y = -20;  // World voxel Y for sewer floor

// Street dimensions
const STREET_WIDTH = 10;  // voxels wide
const BLOCK_SIZE = 40;    // building block spacing (voxels)

// The Varsity (landmark restaurant)
const VARSITY_X = ZONE3_START + 90;
const VARSITY_Z = -30;
const VARSITY_W = 20; // width (X)
const VARSITY_D = 15; // depth (Z)

// Parking garage (multi-story)
const GARAGE_X = ZONE3_START + 130;
const GARAGE_Z = 10;
const GARAGE_W = 16;
const GARAGE_D = 24;

// Construction zone (near apartment, final boss arena)
const CONSTRUCTION_X = APARTMENT_X - 30;
const CONSTRUCTION_Z = -20;
const CONSTRUCTION_W = 25;
const CONSTRUCTION_D = 40;

// ── Zone detection ──────────────────────────────────────────────────
const enum Zone { Highway, Collapse, Underground, Streets }

function getZone(wx: number, wy: number): Zone {
  if (wy < GROUND_Y - 4) return Zone.Underground;
  if (wx < COLLAPSE_START) return Zone.Highway;
  if (wx < COLLAPSE_END) return Zone.Collapse;
  return Zone.Streets;
}

// ── Height map ──────────────────────────────────────────────────────
function getSurfaceHeight(wx: number, wz: number): number {
  const absZ = Math.abs(wz);

  // Highway zone: flat road, gentle hills on grass
  if (wx < COLLAPSE_START) {
    if (absZ < HIGHWAY_HALF_WIDTH) return GROUND_Y; // flat road
    // Gentle rolling hills beside the road
    const hill = fbm(wx * 0.02, wz * 0.02, 3) * 4 - 2;
    return GROUND_Y + Math.floor(hill);
  }

  // Collapse zone: surface drops into the underground
  if (wx < COLLAPSE_END) {
    const t = (wx - COLLAPSE_START) / (COLLAPSE_END - COLLAPSE_START);
    if (absZ < HIGHWAY_HALF_WIDTH) {
      // Road crumbles away — height drops
      const drop = t * t * 20;
      const noise = fbm(wx * 0.1, wz * 0.1, 2) * 4;
      const h = GROUND_Y - Math.floor(drop + noise);
      return Math.max(h, SEWER_FLOOR_Y + 2);
    }
    const hill = fbm(wx * 0.02, wz * 0.02, 3) * 4 - 2;
    return GROUND_Y + Math.floor(hill);
  }

  // Street zone: mostly flat with slight variation
  const streetHill = fbm(wx * 0.015, wz * 0.015, 3) * 3 - 1;
  return GROUND_Y + Math.floor(streetHill);
}

// ── Main entry point ────────────────────────────────────────────────
export function generateTerrain(chunk: ChunkData): void {
  // Skip chunks outside the vertical range of interest
  if (chunk.cy < -2 || chunk.cy > 2) return;

  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const wx = chunk.cx * CHUNK_SIZE + x;
      const wz = chunk.cz * CHUNK_SIZE + z;

      // Skip chunks far outside the world bounds
      if (wx < -40 || wx > WORLD_END + 40) continue;

      const surfaceH = getSurfaceHeight(wx, wz);
      const zone = getZone(wx, surfaceH);

      for (let y = 0; y < CHUNK_SIZE; y++) {
        const wy = chunk.cy * CHUNK_SIZE + y;
        generateVoxel(chunk, x, y, z, wx, wy, wz, surfaceH, zone);
      }
    }
  }

  // Place structures (cars, buildings, etc.) after base terrain
  placeStructures(chunk);
}

// ── Per-voxel generation ────────────────────────────────────────────
function generateVoxel(
  chunk: ChunkData,
  lx: number, ly: number, lz: number,
  wx: number, wy: number, wz: number,
  surfaceH: number, zone: Zone
): void {
  const absZ = Math.abs(wz);

  // ─── Underground generation ───────────────────────────────────
  if (wy < GROUND_Y - 4) {
    generateUnderground(chunk, lx, ly, lz, wx, wy, wz);
    return;
  }

  // ─── Manhole shafts carve through surface/sub-surface ────────
  if (isInManholeShaft(wx, wy, wz)) {
    // Carve the vertical shaft — air inside, with details added by placeStructures
    return;
  }

  // ─── Above surface = air (unless building) ────────────────────
  if (wy > surfaceH) {
    // Buildings and structures are placed in placeStructures()
    return;
  }

  // ─── Surface and sub-surface ──────────────────────────────────
  switch (zone) {
    case Zone.Highway:
      generateHighwaySurface(chunk, lx, ly, lz, wx, wy, wz, surfaceH, absZ);
      break;
    case Zone.Collapse:
      generateCollapseSurface(chunk, lx, ly, lz, wx, wy, wz, surfaceH, absZ);
      break;
    case Zone.Streets:
      generateStreetSurface(chunk, lx, ly, lz, wx, wy, wz, surfaceH, absZ);
      break;
    default:
      break;
  }
}

// ── Highway surface generation ──────────────────────────────────────
function generateHighwaySurface(
  chunk: ChunkData,
  lx: number, ly: number, lz: number,
  wx: number, wy: number, wz: number,
  surfaceH: number, absZ: number
): void {
  const isRoad = absZ < ROAD_HALF_WIDTH;
  const isShoulder = absZ >= ROAD_HALF_WIDTH && absZ < HIGHWAY_HALF_WIDTH;
  const isMedian = absZ < 2;

  if (wy === surfaceH) {
    // Surface layer
    if (isRoad) {
      // Road degrades approaching collapse zone (wx 220-280)
      if (wx > 220 && rand2(wx + 555, wz + 666) < (wx - 220) / 200) {
        chunk.set(lx, ly, lz, rand2(wx, wz + 777) < 0.5 ? DIRT : CONCRETE);
      } else {
        chunk.set(lx, ly, lz, ASPHALT);
        // Lane markings
        if (isMedian && wz % 8 < 5) {
          chunk.set(lx, ly, lz, LANE_YELLOW);
        } else if ((absZ === 5 || absZ === 9 || absZ === 13) && wx % 6 < 4) {
          chunk.set(lx, ly, lz, LANE_WHITE);
        }
      }
    } else if (isShoulder) {
      chunk.set(lx, ly, lz, ASPHALT_SHOULDER);
    } else {
      chunk.set(lx, ly, lz, GRASS);
    }
  } else if (wy > surfaceH - 3) {
    chunk.set(lx, ly, lz, DIRT);
  } else {
    chunk.set(lx, ly, lz, CONCRETE);
  }

  // Guardrails at road edges (1 block tall on surface)
  if (wy === surfaceH + 1 && (absZ === ROAD_HALF_WIDTH || absZ === HIGHWAY_HALF_WIDTH)) {
    chunk.set(lx, ly, lz, GUARDRAIL);
  }

  // Concrete dividers at median (2 blocks tall)
  if (isMedian && absZ === 0 && wy > surfaceH && wy <= surfaceH + 2) {
    chunk.set(lx, ly, lz, CONCRETE);
  }

  // Overpass at Spaghetti Junction (wx 30-70)
  if (wx >= 30 && wx <= 70 && absZ < ROAD_HALF_WIDTH) {
    const overpassY = GROUND_Y + 10; // 10 blocks above ground
    if (wy === overpassY) {
      chunk.set(lx, ly, lz, CONCRETE_OVERPASS);
      // Lane markings on overpass
      if (isMedian && wz % 8 < 5) {
        chunk.set(lx, ly, lz, LANE_YELLOW);
      }
    }
    // Support pillars every 20 blocks
    if (wx % 20 < 2 && absZ < 3 && wy > surfaceH && wy < overpassY) {
      chunk.set(lx, ly, lz, CONCRETE_OVERPASS);
    }
  }
}

// ── Collapse zone surface ───────────────────────────────────────────
function generateCollapseSurface(
  chunk: ChunkData,
  lx: number, ly: number, lz: number,
  wx: number, wy: number, wz: number,
  surfaceH: number, absZ: number
): void {
  const t = (wx - COLLAPSE_START) / (COLLAPSE_END - COLLAPSE_START);

  if (absZ >= HIGHWAY_HALF_WIDTH) {
    // Side terrain — same as highway
    if (wy === surfaceH) {
      chunk.set(lx, ly, lz, GRASS);
    } else if (wy > surfaceH - 3) {
      chunk.set(lx, ly, lz, DIRT);
    } else {
      chunk.set(lx, ly, lz, CONCRETE);
    }
    return;
  }

  // Broken road surface with gaps
  const hasGap = rand2(wx, wz) < t * 0.6;
  if (hasGap && wy >= surfaceH - 1) return; // air gap

  if (wy === surfaceH) {
    // Broken asphalt with debris
    const r = rand2(wx + 100, wz);
    if (r < 0.3) {
      chunk.set(lx, ly, lz, CONCRETE);
    } else if (r < 0.5) {
      chunk.set(lx, ly, lz, RUST);
    } else {
      chunk.set(lx, ly, lz, ASPHALT);
    }
  } else if (wy > surfaceH - 3) {
    chunk.set(lx, ly, lz, DIRT);
  } else {
    chunk.set(lx, ly, lz, CONCRETE);
  }

  // Rebar sticking up from collapse (decorative)
  if (wy === surfaceH + 1 && rand2(wx + 200, wz) < 0.05) {
    chunk.set(lx, ly, lz, RUST);
  }
}

// ── Street grid helpers ─────────────────────────────────────────────
function getStreetGrid(wx: number, wz: number): {
  gridX: number; gridZ: number;
  isStreetX: boolean; isStreetZ: boolean;
  isSidewalk: boolean; isStreet: boolean; isIntersection: boolean;
} {
  const gridX = ((wx - ZONE3_START) % BLOCK_SIZE + BLOCK_SIZE) % BLOCK_SIZE;
  const gridZ = ((wz + BLOCK_SIZE * 10) % BLOCK_SIZE + BLOCK_SIZE) % BLOCK_SIZE;
  const isStreetX = gridX < STREET_WIDTH;
  const isStreetZ = gridZ < STREET_WIDTH;
  const isSidewalk = (gridX < STREET_WIDTH + 2 || gridX >= BLOCK_SIZE - 2) ||
                     (gridZ < STREET_WIDTH + 2 || gridZ >= BLOCK_SIZE - 2);
  const isStreet = isStreetX || isStreetZ;
  const isIntersection = isStreetX && isStreetZ;
  return { gridX, gridZ, isStreetX, isStreetZ, isSidewalk, isStreet, isIntersection };
}

// ── Street surface generation ───────────────────────────────────────
function generateStreetSurface(
  chunk: ChunkData,
  lx: number, ly: number, lz: number,
  wx: number, wy: number, wz: number,
  surfaceH: number, _absZ: number
): void {
  const { gridX, gridZ, isStreetX, isStreetZ, isSidewalk, isStreet, isIntersection } =
    getStreetGrid(wx, wz);

  // ── Ground layer ──
  if (wy === surfaceH) {
    if (isStreet) {
      chunk.set(lx, ly, lz, ASPHALT);
      // Lane markings: center line on streets
      if (isStreetX && !isStreetZ && gridX === Math.floor(STREET_WIDTH / 2) && wx % 6 < 4) {
        chunk.set(lx, ly, lz, LANE_YELLOW);
      }
      if (isStreetZ && !isStreetX && gridZ === Math.floor(STREET_WIDTH / 2) && wz % 6 < 4) {
        chunk.set(lx, ly, lz, LANE_YELLOW);
      }
      // Crosswalk at intersections
      if (isIntersection) {
        const edgeX = gridX < 2 || gridX >= STREET_WIDTH - 2;
        const edgeZ = gridZ < 2 || gridZ >= STREET_WIDTH - 2;
        if ((edgeX || edgeZ) && (wx + wz) % 2 === 0) {
          chunk.set(lx, ly, lz, LANE_WHITE);
        }
      }
    } else if (isSidewalk) {
      chunk.set(lx, ly, lz, SIDEWALK_CONCRETE);
    } else {
      chunk.set(lx, ly, lz, GRASS);
    }
  } else if (wy > surfaceH - 3) {
    chunk.set(lx, ly, lz, DIRT);
  } else {
    chunk.set(lx, ly, lz, CONCRETE);
  }

  // ── Sidewalk furniture (1 block above surface) ──
  if (wy === surfaceH + 1 && isSidewalk && !isStreet) {
    // Fire hydrants
    if (wx % 30 === 0 && wz % 30 === 5) {
      chunk.set(lx, ly, lz, FIRE_HYDRANT);
    }
    // Mailboxes
    else if (wx % 40 === 15 && wz % 40 === 3) {
      chunk.set(lx, ly, lz, MAILBOX_BLUE);
    }
    // Benches along sidewalks
    else if (wx % 25 === 10 && wz % 25 === 7) {
      chunk.set(lx, ly, lz, BENCH_WOOD);
    }
    // Dumpsters in alleys (near building edges)
    else if (gridX === STREET_WIDTH + 2 && wx % 35 === 0 && gridZ > STREET_WIDTH + 4) {
      chunk.set(lx, ly, lz, DUMPSTER_GREEN);
    }
  }

  // ── Street lamps (3 blocks tall on sidewalk corners) ──
  if (isSidewalk && !isStreet) {
    const isLampSpot = wx % 20 === 0 && wz % 20 === 0;
    if (isLampSpot) {
      if (wy > surfaceH && wy <= surfaceH + 3) {
        chunk.set(lx, ly, lz, STREET_LAMP_POLE);
      } else if (wy === surfaceH + 4) {
        chunk.set(lx, ly, lz, STREET_LAMP_LIGHT);
      }
    }
  }

  // ── Traffic lights at intersections ──
  if (isIntersection) {
    // Place traffic light poles at intersection corners
    const cornerX = gridX === 1 || gridX === STREET_WIDTH - 2;
    const cornerZ = gridZ === 1 || gridZ === STREET_WIDTH - 2;
    if (cornerX && cornerZ) {
      if (wy > surfaceH && wy <= surfaceH + 4) {
        chunk.set(lx, ly, lz, TRAFFIC_LIGHT_HOUSING);
      } else if (wy === surfaceH + 5) {
        chunk.set(lx, ly, lz, TRAFFIC_LIGHT_RED);
      } else if (wy === surfaceH + 6) {
        chunk.set(lx, ly, lz, TRAFFIC_LIGHT_GREEN);
      }
    }
  }

  // ── Street trees along sidewalks ──
  if (isSidewalk && !isStreet && wy === surfaceH) {
    if (wx % 15 === 7 && wz % 15 === 0 && gridX >= STREET_WIDTH + 2 && gridZ >= STREET_WIDTH + 2) {
      // Plant tree above (handled in placeStructures via placeStreetTree)
    }
  }

  // ── Peachtree street signs at intersections ──
  if (isIntersection && gridX === 0 && gridZ === 0) {
    if (wy > surfaceH && wy <= surfaceH + 3) {
      chunk.set(lx, ly, lz, SIGN_POST);
    } else if (wy === surfaceH + 4) {
      chunk.set(lx, ly, lz, SIGN_GREEN);
    }
  }
}

// ── Underground generation ──────────────────────────────────────────
function generateUnderground(
  chunk: ChunkData,
  lx: number, ly: number, lz: number,
  wx: number, wy: number, wz: number
): void {
  const absZ = Math.abs(wz);

  // Determine if we're in an underground void (tunnel/cave) or solid
  const inMainTunnel = isInMainTunnel(wx, wy, wz);
  const inSewer = isInSewerNetwork(wx, wy, wz);
  const inMARTA = isInMARTAStation(wx, wy, wz);
  const inCave = isInCave(wx, wy, wz);
  const inManhole = isInManholeShaft(wx, wy, wz);

  const isVoid = inMainTunnel || inSewer || inMARTA || inCave || inManhole;

  if (isVoid) {
    // Manhole shaft interior — add ladder rungs and frame
    if (inManhole) {
      // Ladder rungs on one wall of the shaft
      for (const [mx, mz] of MANHOLE_SHAFTS) {
        if (Math.abs(wx - mx) <= 1 && Math.abs(wz - mz) <= 1) {
          // Ladder on the north wall (wz === mz - 1)
          if (wz === mz - 1 && wx === mx && wy % 2 === 0) {
            chunk.set(lx, ly, lz, LADDER_RUNG);
            return;
          }
          // Manhole frame at ground level
          if (wy === GROUND_Y && (Math.abs(wx - mx) === 1 || Math.abs(wz - mz) === 1)) {
            chunk.set(lx, ly, lz, MANHOLE_FRAME);
            return;
          }
          break;
        }
      }
      return; // air
    }

    // Tunnel/cave interior
    if (inSewer && wy <= SEWER_FLOOR_Y + 1) {
      chunk.set(lx, ly, lz, SEWER_WATER);
      return;
    }

    // Moss and grime on tunnel walls (border voxels)
    const nearWall = isNearTunnelWall(wx, wy, wz);
    if (nearWall) {
      const r = rand3(wx, wy, wz);
      if (r < 0.15) {
        chunk.set(lx, ly, lz, GRIME_MOSS);
      } else if (r < 0.2) {
        chunk.set(lx, ly, lz, ALGAE_GLOW);
      }
      return;
    }

    // Pipes along tunnel ceilings
    if (inMainTunnel && wy === SEWER_FLOOR_Y + TUNNEL_RADIUS * 2 - 1 && absZ % 8 === 0) {
      const pipeR = rand2(wx + 500, wz);
      if (pipeR < 0.3) {
        chunk.set(lx, ly, lz, pipeR < 0.15 ? RUST_PIPE : METAL_PIPE);
        return;
      }
    }

    // Glowing crystals in caves (rare, atmospheric)
    if (inCave && nearWall) {
      // Already handled above, but for cave-only crystal decoration
    } else if (inCave) {
      const crystalR = rand3(wx + 999, wy + 888, wz + 777);
      if (crystalR < 0.008) {
        chunk.set(lx, ly, lz, CAVE_CRYSTAL);
        return;
      }
    }

    return; // air
  }

  // Solid underground
  const depthBelow = GROUND_Y - wy;
  if (depthBelow < 8) {
    chunk.set(lx, ly, lz, DIRT);
  } else if (depthBelow < 15) {
    const r = rand3(wx, wy, wz);
    chunk.set(lx, ly, lz, r < 0.3 ? TUNNEL_BRICK : TUNNEL_CONCRETE);
  } else {
    chunk.set(lx, ly, lz, TUNNEL_CONCRETE);
  }
}

// ── Tunnel shape functions ──────────────────────────────────────────

/** Main storm drain tunnels running along X axis */
function isInMainTunnel(wx: number, wy: number, wz: number): boolean {
  // Only in the area accessible from the collapse
  if (wx < COLLAPSE_START - 60 || wx > ZONE3_START + 100) return false;

  // Main tunnel along Z=0
  const distFromCenter = Math.abs(wz);
  const tunnelFloor = SEWER_FLOOR_Y;
  const tunnelCeil = tunnelFloor + TUNNEL_RADIUS * 2;

  if (distFromCenter < TUNNEL_RADIUS && wy > tunnelFloor && wy < tunnelCeil) {
    return true;
  }

  // Branch tunnels at Z = +/-30 (large) and Z = +/-15 (smaller utility corridors)
  for (const tz of [-30, 30]) {
    const dist = Math.abs(wz - tz);
    if (dist < 4 && wy > tunnelFloor + 2 && wy < tunnelFloor + 10) {
      if (wx > COLLAPSE_START - 40 && wx < ZONE3_START + 60) {
        return true;
      }
    }
  }
  // Smaller utility corridors at Z = +/-15
  for (const tz of [-15, 15]) {
    const dist = Math.abs(wz - tz);
    if (dist < 3 && wy > tunnelFloor + 2 && wy < tunnelFloor + 8) {
      if (wx > COLLAPSE_START - 20 && wx < ZONE3_START + 40) {
        return true;
      }
    }
  }

  // Connecting cross-tunnels every 60 voxels along X
  if (wx % 60 < 4 && wx > COLLAPSE_START - 40 && wx < ZONE3_START + 60) {
    const distCross = Math.abs(wz);
    if (distCross < 35 && wy > tunnelFloor + 2 && wy < tunnelFloor + 8) {
      return true;
    }
  }

  // Additional cross-tunnels every 40 voxels connecting utility corridors
  if ((wx + 20) % 40 < 3 && wx > COLLAPSE_START && wx < ZONE3_START + 40) {
    const distCross = Math.abs(wz);
    if (distCross < 18 && wy > tunnelFloor + 2 && wy < tunnelFloor + 7) {
      return true;
    }
  }

  // Junction chambers: wider areas where cross-tunnels meet the main tunnel
  if (wx % 60 < 8 && wx % 60 >= 0 && wx > COLLAPSE_START - 40 && wx < ZONE3_START + 60) {
    if (distFromCenter < TUNNEL_RADIUS + 3 && wy > tunnelFloor && wy < tunnelCeil + 2) {
      return true;
    }
  }

  return false;
}

/** Manhole shaft positions — vertical exits to surface */
const MANHOLE_SHAFTS: Array<[number, number]> = [
  [420, 0],    // East tunnel → street zone surface
  [350, -15],  // Near zone boundary → street zone
  [260, 15],   // Mid-tunnel → collapse zone surface
];

/** Check if position is inside a manhole shaft (vertical exit to surface) */
function isInManholeShaft(wx: number, wy: number, wz: number): boolean {
  if (wy < SEWER_FLOOR_Y || wy > GROUND_Y + 1) return false;
  for (const [mx, mz] of MANHOLE_SHAFTS) {
    if (Math.abs(wx - mx) <= 1 && Math.abs(wz - mz) <= 1) {
      return true;
    }
  }
  return false;
}

/** Sewer network — branching tunnels in the deeper area */
function isInSewerNetwork(wx: number, wy: number, wz: number): boolean {
  if (wx < COLLAPSE_START - 20 || wx > ZONE3_START + 80) return false;
  if (wy > SEWER_FLOOR_Y + 4 || wy < SEWER_FLOOR_Y - 2) return false;

  // Winding sewer channels at Y = SEWER_FLOOR_Y
  const sewerNoise = noise2D(wx * 0.08, wz * 0.08);
  const channelWidth = 3 + noise2D(wx * 0.03, wz * 0.05) * 2;

  // Main sewer channel
  const channelZ = Math.sin(wx * 0.05) * 15;
  if (Math.abs(wz - channelZ) < channelWidth) return true;

  // Secondary channel
  const channel2Z = Math.cos(wx * 0.04 + 2) * 20;
  if (Math.abs(wz - channel2Z) < channelWidth * 0.7 && sewerNoise > 0.3) return true;

  return false;
}

/** MARTA station — large open area */
function isInMARTAStation(wx: number, wy: number, wz: number): boolean {
  // Station centered at wx=310, wz=0
  const stationCenterX = 310;
  const stationCenterZ = 0;
  const stationHalfX = 20;
  const stationHalfZ = 12;

  if (Math.abs(wx - stationCenterX) > stationHalfX) return false;
  if (Math.abs(wz - stationCenterZ) > stationHalfZ) return false;

  // Station floor to ceiling
  const stationFloor = SEWER_FLOOR_Y + 3;
  const stationCeil = GROUND_Y - 6;
  if (wy <= stationFloor || wy >= stationCeil) return false;

  return true;
}

/** Natural cave areas for variety */
function isInCave(wx: number, wy: number, wz: number): boolean {
  if (wx < COLLAPSE_START || wx > ZONE3_START + 40) return false;
  if (wy > SEWER_FLOOR_Y + 12 || wy < SEWER_FLOOR_Y - 4) return false;

  // Use 3D noise for organic cave shapes
  const caveNoise = noise2D(wx * 0.05 + wy * 0.1, wz * 0.05 + wy * 0.08);
  const caveThreshold = 0.65;

  return caveNoise > caveThreshold;
}

/** Check if a position is near a tunnel wall (for moss/decoration) */
function isNearTunnelWall(wx: number, wy: number, wz: number): boolean {
  // Check if any neighbor is solid
  for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
    const nx = wx + dx;
    const ny = wy + dy;
    const nz = wz + dz;
    if (!isInMainTunnel(nx, ny, nz) && !isInSewerNetwork(nx, ny, nz) &&
        !isInMARTAStation(nx, ny, nz) && !isInCave(nx, ny, nz) &&
        !isInManholeShaft(nx, ny, nz)) {
      return true;
    }
  }
  return false;
}

// ── Structure placement (cars, buildings, trees, landmarks) ─────────
function placeStructures(chunk: ChunkData): void {
  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const wx = chunk.cx * CHUNK_SIZE + x;
      const wz = chunk.cz * CHUNK_SIZE + z;

      if (wx < 0 || wx > WORLD_END) continue;

      const surfaceH = getSurfaceHeight(wx, wz);
      const zone = getZone(wx, surfaceH);

      // Cars on the highway
      if (zone === Zone.Highway || zone === Zone.Collapse) {
        placeCar(chunk, x, z, wx, wz, surfaceH);
      }

      // Trees beside the highway
      if (zone === Zone.Highway && Math.abs(wz) > HIGHWAY_HALF_WIDTH + 2) {
        placeTree(chunk, x, z, wx, wz, surfaceH);
      }

      // Highway environmental structures
      if (zone === Zone.Highway) {
        placeHighwaySign(chunk, x, z, wx, wz, surfaceH);
        placeHighwayBarrels(chunk, x, z, wx, wz, surfaceH);
        placeHighwaySewerGrate(chunk, x, z, wx, wz, surfaceH);
        placeRoadDebris(chunk, x, z, wx, wz, surfaceH);
        placeWelcomeSign(chunk, x, z, wx, wz, surfaceH);
        placeHighwayBillboard(chunk, x, z, wx, wz, surfaceH);
      }

      // ── Street zone structures ──
      if (zone === Zone.Streets) {
        // Buildings
        placeBuilding(chunk, x, z, wx, wz, surfaceH);

        // Street trees on sidewalks
        placeStreetTree(chunk, x, z, wx, wz, surfaceH);

        // Parked cars on streets
        placeStreetCar(chunk, x, z, wx, wz, surfaceH);
      }

      // The Varsity restaurant
      if (wx >= VARSITY_X && wx < VARSITY_X + VARSITY_W &&
          wz >= VARSITY_Z && wz < VARSITY_Z + VARSITY_D) {
        placeVarsity(chunk, x, z, wx, wz, surfaceH);
      }

      // Parking garage
      if (wx >= GARAGE_X && wx < GARAGE_X + GARAGE_W &&
          wz >= GARAGE_Z && wz < GARAGE_Z + GARAGE_D) {
        placeParkingGarage(chunk, x, z, wx, wz, surfaceH);
      }

      // Construction zone near apartment
      if (wx >= CONSTRUCTION_X && wx < CONSTRUCTION_X + CONSTRUCTION_W &&
          wz >= CONSTRUCTION_Z && wz < CONSTRUCTION_Z + CONSTRUCTION_D) {
        placeConstructionZone(chunk, x, z, wx, wz, surfaceH);
      }

      // Apartment building
      if (wx >= APARTMENT_X && wx < APARTMENT_X + 20 && Math.abs(wz) < 12) {
        placeApartment(chunk, x, z, wx, wz, surfaceH);
      }

      // Apartment exterior details (welcome mat, awning, sign, path)
      if (wx >= APARTMENT_X - 1 && wx < APARTMENT_X + 21 && wz >= -16 && wz <= -12) {
        placeApartmentExterior(chunk, x, z, wx, wz, surfaceH);
      }

      // Waffle House near zone 3 start
      if (wx >= ZONE3_START + 5 && wx < ZONE3_START + 20 &&
          wz >= -15 && wz < -5) {
        placeWaffleHouse(chunk, x, z, wx, wz, surfaceH);
      }

      // MARTA station entrance (above ground)
      placeMARTAEntrance(chunk, x, z, wx, wz, surfaceH);

      // Underground structure details (MARTA interior, manholes)
      placeUndergroundStructures(chunk, x, z, wx, wz);
    }
  }
}

/** Place a car at the given position (if the hash says so) — with vehicle variety */
function placeCar(
  chunk: ChunkData, lx: number, lz: number,
  wx: number, wz: number, surfaceH: number
): void {
  const absZ = Math.abs(wz);
  if (absZ >= ROAD_HALF_WIDTH || absZ < 2) return; // not on road or on median

  // Cars every ~6 voxels along X, staggered by lane
  const carSlot = Math.floor(wx / 6);
  const laneSlot = Math.floor(absZ / 4);
  const r = rand2(carSlot * 7 + 1000, laneSlot * 13 + 500);
  if (r > 0.45) return; // ~45% chance of car in each slot

  // Only place at the car's origin position (avoid duplicates)
  const carOriginX = carSlot * 6;
  const carOriginZ = laneSlot * 4 * (wz >= 0 ? 1 : -1);
  if (wx !== carOriginX || wz !== carOriginZ) return;

  const carColor = CAR_COLORS[Math.floor(rand2(wx, wz + 777) * CAR_COLORS.length)];

  // Vehicle type selection based on hash
  const typeR = rand2(wx + 999, wz + 888);
  let carLen: number, carWid: number, carH: number;
  let wsStart: number, wsEnd: number; // windshield X range
  let openBedStart = -1; // -1 = no open bed
  let isDamaged = false;

  if (typeR < 0.35) {
    // Sedan (most common)
    carLen = 8; carWid = 3; carH = 3;
    wsStart = 2; wsEnd = 5;
  } else if (typeR < 0.55) {
    // Pickup truck — taller with open bed
    carLen = 9; carWid = 3; carH = 4;
    wsStart = 2; wsEnd = 4;
    openBedStart = 5;
  } else if (typeR < 0.75) {
    // SUV — taller, boxier
    carLen = 8; carWid = 3; carH = 4;
    wsStart = 2; wsEnd = 5;
  } else if (typeR < 0.90) {
    // Van / minivan — longer, cargo-style
    carLen = 10; carWid = 3; carH = 4;
    wsStart = 2; wsEnd = 3;
  } else {
    // Damaged sedan — rust-colored, missing blocks
    carLen = 8; carWid = 3; carH = 3;
    wsStart = 2; wsEnd = 5;
    isDamaged = true;
  }

  for (let cx = 0; cx < carLen; cx++) {
    for (let cz = 0; cz < carWid; cz++) {
      for (let cy = 0; cy < carH; cy++) {
        const px = lx + cx;
        const pz = lz + cz;
        const py = surfaceH + 1 + cy - chunk.cy * CHUNK_SIZE;

        if (px < 0 || px >= CHUNK_SIZE || pz < 0 || pz >= CHUNK_SIZE ||
            py < 0 || py >= CHUNK_SIZE) continue;

        // Open bed — skip interior blocks above bed walls
        if (openBedStart >= 0 && cx >= openBedStart && cy >= 2 &&
            cz > 0 && cz < carWid - 1) {
          continue;
        }

        // Damaged car — randomly skip blocks to show destruction
        if (isDamaged && rand3(wx + cx, cy + 50, wz + cz) < 0.25) {
          continue;
        }

        // Tires at bottom corners
        if (cy === 0 && (cx === 1 || cx === carLen - 2) && (cz === 0 || cz === carWid - 1)) {
          chunk.set(px, py, pz, TIRE);
          continue;
        }

        // Bottom row = chassis
        if (cy === 0) {
          chunk.set(px, py, pz, isDamaged ? RUST : carColor);
          continue;
        }

        // Top row = windshield/roof
        if (cy === carH - 1) {
          if (cx >= wsStart && cx <= wsEnd) {
            // Damaged windshields have holes
            if (isDamaged && rand3(wx + cx, cy + 100, wz + cz) < 0.4) {
              continue; // broken windshield = air
            }
            chunk.set(px, py, pz, GLASS_WINDSHIELD);
          } else {
            chunk.set(px, py, pz, isDamaged ? RUST : carColor);
          }
          continue;
        }

        // Middle rows: sides/front/back = body, inside = interior
        if (cz === 0 || cz === carWid - 1 || cx === 0 || cx === carLen - 1) {
          chunk.set(px, py, pz, isDamaged ? RUST : carColor);
        } else {
          chunk.set(px, py, pz, CAR_INTERIOR);
        }
      }
    }
  }
}

/** Place a tree */
function placeTree(
  chunk: ChunkData, lx: number, lz: number,
  wx: number, wz: number, surfaceH: number
): void {
  // Sparse trees — hash determines placement
  if (rand2(wx * 3 + 42, wz * 5 + 17) > 0.03) return;

  const trunkH = 4 + Math.floor(rand2(wx, wz + 200) * 3);
  const crownR = 2 + Math.floor(rand2(wx + 300, wz) * 2);

  // Trunk
  for (let ty = 1; ty <= trunkH; ty++) {
    const py = surfaceH + ty - chunk.cy * CHUNK_SIZE;
    if (py >= 0 && py < CHUNK_SIZE) {
      chunk.set(lx, py, lz, TREE_TRUNK);
    }
  }

  // Crown (sphere-ish)
  for (let dx = -crownR; dx <= crownR; dx++) {
    for (let dz = -crownR; dz <= crownR; dz++) {
      for (let dy = 0; dy <= crownR; dy++) {
        if (dx * dx + dy * dy + dz * dz > crownR * crownR + 1) continue;
        const px = lx + dx;
        const pz = lz + dz;
        const py = surfaceH + trunkH + dy - chunk.cy * CHUNK_SIZE;
        if (px >= 0 && px < CHUNK_SIZE && pz >= 0 && pz < CHUNK_SIZE &&
            py >= 0 && py < CHUNK_SIZE) {
          if (chunk.get(px, py, pz) === 0) {
            chunk.set(px, py, pz, TREE_LEAVES);
          }
        }
      }
    }
  }
}

// ── Highway zone environmental structures ────────────────────────────

/** Place green highway signs on tall poles along the highway */
function placeHighwaySign(
  chunk: ChunkData, lx: number, lz: number,
  wx: number, wz: number, surfaceH: number
): void {
  // Signs every 80 voxels along X, on the right side of the highway
  if (wx % 80 !== 0 || wx < 10 || wx > COLLAPSE_START) return;
  if (wz !== HIGHWAY_HALF_WIDTH + 1) return;

  const poleH = 10;
  const signW = 12; // sign width (X direction)
  const signH = 4;

  // Pole
  for (let py = 1; py <= poleH; py++) {
    const localY = surfaceH + py - chunk.cy * CHUNK_SIZE;
    if (localY >= 0 && localY < CHUNK_SIZE) {
      chunk.set(lx, localY, lz, SIGN_POST);
    }
  }

  // Sign face (extends in X direction from the pole)
  for (let sx = -Math.floor(signW / 2); sx <= Math.floor(signW / 2); sx++) {
    for (let sy = 0; sy < signH; sy++) {
      const px = lx + sx;
      const py = surfaceH + poleH + 1 + sy - chunk.cy * CHUNK_SIZE;
      if (px >= 0 && px < CHUNK_SIZE && py >= 0 && py < CHUNK_SIZE) {
        // White text rows in the middle of the green sign
        if ((sy === 1 || sy === 2) && (sx + 6) % 3 === 0) {
          chunk.set(px, py, lz, LANE_WHITE);
        } else {
          chunk.set(px, py, lz, SIGN_GREEN);
        }
      }
    }
  }
}

/** Place construction barrels and cones on the highway (wx 100-150 area) */
function placeHighwayBarrels(
  chunk: ChunkData, lx: number, lz: number,
  wx: number, wz: number, surfaceH: number
): void {
  if (wx < 100 || wx > 150) return;
  const absZ = Math.abs(wz);

  // Barrels on the right shoulder (lane closure)
  if (absZ >= ROAD_HALF_WIDTH - 2 && absZ <= ROAD_HALF_WIDTH && wz > 0) {
    if (wx % 4 === 0) {
      for (let by = 1; by <= 3; by++) {
        const py = surfaceH + by - chunk.cy * CHUNK_SIZE;
        if (py >= 0 && py < CHUNK_SIZE) {
          chunk.set(lx, py, lz, by === 2 ? CONSTRUCTION_YELLOW : CONSTRUCTION_ORANGE);
        }
      }
    }
  }

  // Cones along the lane edge (smaller, 2 blocks tall)
  if (absZ === ROAD_HALF_WIDTH - 3 && wx % 6 === 0 && wz > 0) {
    for (let by = 1; by <= 2; by++) {
      const py = surfaceH + by - chunk.cy * CHUNK_SIZE;
      if (py >= 0 && py < CHUNK_SIZE) {
        chunk.set(lx, py, lz, CONSTRUCTION_ORANGE);
      }
    }
  }

  // Scaffolding/barrier at the construction entrance (wx 110-130)
  if (wx >= 110 && wx <= 130 && absZ === HIGHWAY_HALF_WIDTH && wz > 0) {
    for (let by = 1; by <= 2; by++) {
      const py = surfaceH + by - chunk.cy * CHUNK_SIZE;
      if (py >= 0 && py < CHUNK_SIZE) {
        chunk.set(lx, py, lz, CONSTRUCTION_YELLOW);
      }
    }
  }
}

/** Place sewer grate access points on the highway shoulder */
function placeHighwaySewerGrate(
  chunk: ChunkData, lx: number, lz: number,
  wx: number, wz: number, surfaceH: number
): void {
  // Sewer grates at specific X positions on the right shoulder
  // 2x2 grate blocks that hint at underground access
  if (wz !== ROAD_HALF_WIDTH + 1 && wz !== ROAD_HALF_WIDTH + 2) return;

  const isGrateX = (Math.abs(wx - 60) <= 1 || Math.abs(wx - 140) <= 1 ||
                    Math.abs(wx - 200) <= 1 || Math.abs(wx - 260) <= 1);
  if (!isGrateX) return;

  // Place grate on surface (replaces shoulder asphalt)
  const py = surfaceH - chunk.cy * CHUNK_SIZE;
  if (py >= 0 && py < CHUNK_SIZE) {
    chunk.set(lx, py, lz, SEWER_GRATE_FLOOR);
  }

  // Small cavity below (4 blocks deep — suggests underground exists)
  for (let dy = -1; dy >= -4; dy--) {
    const cavY = surfaceH + dy - chunk.cy * CHUNK_SIZE;
    if (cavY >= 0 && cavY < CHUNK_SIZE) {
      chunk.set(lx, cavY, lz, 0); // air
    }
  }
}

/** Place scattered debris on the highway surface */
function placeRoadDebris(
  chunk: ChunkData, lx: number, lz: number,
  wx: number, wz: number, surfaceH: number
): void {
  const absZ = Math.abs(wz);
  if (absZ >= HIGHWAY_HALF_WIDTH) return;

  // Sparse debris — 2% chance per position
  const r = rand2(wx * 11 + 7777, wz * 17 + 3333);
  if (r > 0.02) return;

  const py = surfaceH + 1 - chunk.cy * CHUNK_SIZE;
  if (py < 0 || py >= CHUNK_SIZE) return;

  // Random debris type
  const typeR = rand2(wx + 4444, wz + 5555);
  let blockId: number;
  if (typeR < 0.25) blockId = CONCRETE;           // concrete chunk
  else if (typeR < 0.45) blockId = RUST;           // rusty metal
  else if (typeR < 0.60) blockId = TIRE;           // tire fragment
  else if (typeR < 0.75) blockId = CONSTRUCTION_ORANGE; // cone tip
  else if (typeR < 0.90) blockId = GUARDRAIL;      // barrier piece
  else blockId = GLASS_WINDSHIELD;                  // broken glass

  chunk.set(lx, py, lz, blockId);
}

/** Place a "Welcome to Atlanta" sign near the start */
function placeWelcomeSign(
  chunk: ChunkData, lx: number, lz: number,
  wx: number, wz: number, surfaceH: number
): void {
  // Sign at wx=-5, on the right side of the highway
  if (wx < -5 || wx > 7) return;
  if (wz !== -HIGHWAY_HALF_WIDTH - 2) return;
  if (wx !== -5) return; // origin check

  const signW = 12;
  const signH = 5;
  const poleH = 6;

  // Two support poles
  for (const poleX of [0, signW - 1]) {
    for (let py = 1; py <= poleH; py++) {
      const px = lx + poleX;
      const localY = surfaceH + py - chunk.cy * CHUNK_SIZE;
      if (px >= 0 && px < CHUNK_SIZE && localY >= 0 && localY < CHUNK_SIZE) {
        chunk.set(px, localY, lz, SIGN_POST);
      }
    }
  }

  // Sign face
  for (let sx = 0; sx < signW; sx++) {
    for (let sy = 0; sy < signH; sy++) {
      const px = lx + sx;
      const py = surfaceH + poleH + 1 + sy - chunk.cy * CHUNK_SIZE;
      if (px >= 0 && px < CHUNK_SIZE && py >= 0 && py < CHUNK_SIZE) {
        // Border in white, interior in green
        const isBorder = sx === 0 || sx === signW - 1 || sy === 0 || sy === signH - 1;
        chunk.set(px, py, lz, isBorder ? LANE_WHITE : SIGN_GREEN);
      }
    }
  }
}

/** Place a billboard structure along the highway */
function placeHighwayBillboard(
  chunk: ChunkData, lx: number, lz: number,
  wx: number, wz: number, surfaceH: number
): void {
  // Billboards at specific X positions, far from the road
  if (wz !== -HIGHWAY_HALF_WIDTH - 5) return;
  // Two billboards along the highway
  if (wx !== 50 && wx !== 180) return;

  const poleH = 12;
  const boardW = 16;
  const boardH = 6;

  // Support poles (two)
  for (const off of [3, boardW - 4]) {
    for (let py = 1; py <= poleH; py++) {
      const px = lx + off;
      const localY = surfaceH + py - chunk.cy * CHUNK_SIZE;
      if (px >= 0 && px < CHUNK_SIZE && localY >= 0 && localY < CHUNK_SIZE) {
        chunk.set(px, localY, lz, STEEL_STRUCTURAL);
      }
    }
  }

  // Billboard face
  for (let sx = 0; sx < boardW; sx++) {
    for (let sy = 0; sy < boardH; sy++) {
      const px = lx + sx;
      const py = surfaceH + poleH + 1 + sy - chunk.cy * CHUNK_SIZE;
      if (px >= 0 && px < CHUNK_SIZE && py >= 0 && py < CHUNK_SIZE) {
        // Colorful billboard: mostly white with colored accent
        const isBorder = sx === 0 || sx === boardW - 1 || sy === 0 || sy === boardH - 1;
        if (isBorder) {
          chunk.set(px, py, lz, STEEL_STRUCTURAL);
        } else {
          // Alternating colored blocks for "advertisement" effect
          const adColor = (sx + sy) % 5 === 0 ? CONSTRUCTION_YELLOW :
                          (sx + sy) % 7 === 0 ? VARSITY_RED : LANE_WHITE;
          chunk.set(px, py, lz, adColor);
        }
      }
    }
  }
}

/** Place a building in the street zone — enterable with floors and interiors */
function placeBuilding(
  chunk: ChunkData, lx: number, lz: number,
  wx: number, wz: number, surfaceH: number
): void {
  // Buildings occupy the blocks between streets
  const gridX = ((wx - ZONE3_START) % BLOCK_SIZE + BLOCK_SIZE) % BLOCK_SIZE;
  const gridZ = ((wz + BLOCK_SIZE * 10) % BLOCK_SIZE + BLOCK_SIZE) % BLOCK_SIZE;

  // Only build in the interior of blocks (not on streets or sidewalks)
  if (gridX < STREET_WIDTH + 3 || gridX >= BLOCK_SIZE - 3) return;
  if (gridZ < STREET_WIDTH + 3 || gridZ >= BLOCK_SIZE - 3) return;

  // Don't place buildings where special structures go
  if (wx >= APARTMENT_X - 2 && wx < APARTMENT_X + 22 && Math.abs(wz) < 14) return;
  // Don't overlap with Varsity
  if (wx >= VARSITY_X && wx < VARSITY_X + VARSITY_W &&
      wz >= VARSITY_Z && wz < VARSITY_Z + VARSITY_D) return;
  // Don't overlap with parking garage
  if (wx >= GARAGE_X && wx < GARAGE_X + GARAGE_W &&
      wz >= GARAGE_Z && wz < GARAGE_Z + GARAGE_D) return;
  // Don't overlap with construction zone
  if (wx >= CONSTRUCTION_X && wx < CONSTRUCTION_X + CONSTRUCTION_W &&
      wz >= CONSTRUCTION_Z && wz < CONSTRUCTION_Z + CONSTRUCTION_D) return;

  // Building height based on block position (deterministic)
  const blockIdX = Math.floor((wx - ZONE3_START) / BLOCK_SIZE);
  const blockIdZ = Math.floor((wz + BLOCK_SIZE * 10) / BLOCK_SIZE);
  const buildingH = 8 + Math.floor(rand2(blockIdX * 7 + 100, blockIdZ * 11 + 200) * 24);

  // Building footprint margins
  const marginX = gridX - (STREET_WIDTH + 3);
  const marginZ = gridZ - (STREET_WIDTH + 3);
  const buildableX = BLOCK_SIZE - STREET_WIDTH - 6;
  const buildableZ = BLOCK_SIZE - STREET_WIDTH - 6;

  // Only build within the footprint
  if (marginX < 0 || marginX >= buildableX || marginZ < 0 || marginZ >= buildableZ) return;

  // Wall or interior?
  const isWallX = marginX === 0 || marginX === buildableX - 1;
  const isWallZ = marginZ === 0 || marginZ === buildableZ - 1;
  const isWall = isWallX || isWallZ;

  // Brick color for this building
  const brickType = rand2(blockIdX, blockIdZ) < 0.5 ? BRICK_RED : BRICK_BROWN;

  // Floor height (story height = 5 voxels: 4 air + 1 floor)
  const STORY_HEIGHT = 5;

  for (let by = 1; by <= buildingH; by++) {
    const py = surfaceH + by - chunk.cy * CHUNK_SIZE;
    if (py < 0 || py >= CHUNK_SIZE) continue;

    const storyIndex = Math.floor((by - 1) / STORY_HEIGHT);
    const levelInStory = (by - 1) % STORY_HEIGHT;
    const isFloorLevel = levelInStory === 0 && by > 1; // floor plates between stories

    if (isWall) {
      // Windows: 2 voxels tall, every 3 blocks horizontally, at mid-story
      const isWindowLevel = levelInStory >= 2 && levelInStory <= 3;
      const isWindowH = (marginX + marginZ) % 3 === 1;

      if (isWindowLevel && isWindowH && by > 1 && by < buildingH) {
        chunk.set(lx, py, lz, WINDOW_GLASS);
      } else {
        chunk.set(lx, py, lz, brickType);
      }

      // Front door(s) on ground floor — one on each street-facing side
      if (by <= 2 && isWallZ && marginZ === 0) {
        const doorPos = Math.floor(buildableX / 2);
        if (Math.abs(marginX - doorPos) <= 1) {
          chunk.set(lx, py, lz, by === 1 ? DOOR_WOOD : WINDOW_FRAME);
        }
      }
      // Side door
      if (by <= 2 && isWallX && marginX === 0) {
        const doorPosZ = Math.floor(buildableZ / 2);
        if (Math.abs(marginZ - doorPosZ) <= 1) {
          chunk.set(lx, py, lz, by === 1 ? DOOR_METAL : WINDOW_FRAME);
        }
      }

      // Ground floor awning over entrance
      if (by === 3 && isWallZ && marginZ === 0 && marginX >= 2 && marginX < buildableX - 2) {
        chunk.set(lx, py, lz, AWNING_DARK);
      }
    } else {
      // ── Interior ──

      // Floor plates between stories
      if (isFloorLevel) {
        chunk.set(lx, py, lz, FLOOR_TILE);
      }

      // Interior divider walls (split building into rooms per floor)
      // Vertical wall at 1/3 of building width
      const dividerX = Math.floor(buildableX / 3);
      const dividerZ = Math.floor(buildableZ / 2);
      if (marginX === dividerX && !isFloorLevel && levelInStory > 0 && storyIndex > 0) {
        // Leave doorway gap in divider
        if (marginZ !== dividerZ && marginZ !== dividerZ + 1) {
          chunk.set(lx, py, lz, DRYWALL);
        }
      }

      // Ground floor counter/furniture
      if (storyIndex === 0 && levelInStory === 1) {
        // Counter along one interior wall
        if (marginX >= 2 && marginX <= 4 && marginZ === buildableZ - 2) {
          chunk.set(lx, py, lz, COUNTER_TOP);
        }
      }
    }

    // Roof
    if (by === buildingH) {
      chunk.set(lx, py, lz, CONCRETE);
    }
  }
}

/** Place the apartment building (goal destination) */
function placeApartment(
  chunk: ChunkData, lx: number, lz: number,
  wx: number, wz: number, surfaceH: number
): void {
  const relX = wx - APARTMENT_X;
  const relZ = wz + 12; // shift so building starts at wz=-12

  if (relX < 0 || relX >= 20 || relZ < 0 || relZ >= 24) return;

  const aptHeight = 36; // 6 stories at 6 voxels each
  const isWallX = relX === 0 || relX === 19;
  const isWallZ = relZ === 0 || relZ === 23;
  const isWall = isWallX || isWallZ;

  // --- Front entrance details (below the building, at ground level) ---

  // Welcome mat in front of the door (relZ === 0 face, one voxel outside)
  // Handled by placeApartmentExterior for voxels outside the building footprint

  // --- Building structure ---
  for (let by = 1; by <= aptHeight; by++) {
    const py = surfaceH + by - chunk.cy * CHUNK_SIZE;
    if (py < 0 || py >= CHUNK_SIZE) continue;

    // Roof
    if (by === aptHeight) {
      chunk.set(lx, py, lz, CONCRETE);
      continue;
    }

    // Front door (relZ === 0, centered on X)
    if (by <= 3 && relZ === 0 && relX >= 8 && relX <= 11) {
      if (by <= 2) {
        chunk.set(lx, py, lz, 0); // open doorway (air) for win trigger
      } else {
        chunk.set(lx, py, lz, WINDOW_GLASS); // transom window
      }
      continue;
    }

    if (isWall) {
      // Windows
      const floorInStory = by % 6;
      const isWindowLevel = floorInStory >= 2 && floorInStory <= 4;
      const isWindowCol = (relX + relZ) % 4 >= 1 && (relX + relZ) % 4 <= 2;

      if (isWindowLevel && isWindowCol && by > 2 && by < aptHeight) {
        chunk.set(lx, py, lz, WINDOW_GLASS);
      } else {
        chunk.set(lx, py, lz, BRICK_RED);
      }
      continue;
    }

    // --- Interior (first floor only, by 1-5) ---
    if (by <= 5) {
      placeApartmentInterior(chunk, lx, py, lz, relX, relZ, by);
      continue;
    }

    // Upper floors: floor slabs every 6 voxels
    if (by % 6 === 0 && relX >= 1 && relX <= 18 && relZ >= 1 && relZ <= 22) {
      chunk.set(lx, py, lz, CONCRETE);
    }
  }
}

/** Place interior furnishings on the first floor of the apartment */
function placeApartmentInterior(
  chunk: ChunkData, lx: number, py: number, lz: number,
  relX: number, relZ: number, by: number
): void {
  // Interior bounds: relX 1-18, relZ 1-22
  if (relX < 1 || relX > 18 || relZ < 1 || relZ > 22) return;

  // Ground floor (by === 1): flooring
  if (by === 1) {
    // Carpet in living room area (relX 2-10, relZ 2-10)
    if (relX >= 2 && relX <= 10 && relZ >= 2 && relZ <= 10) {
      chunk.set(lx, py, lz, CARPET_RED);
    } else {
      chunk.set(lx, py, lz, HARDWOOD_FLOOR);
    }
    return;
  }

  // Internal dividing wall between living room and bedroom (relZ === 12)
  if (relZ === 12 && by <= 4) {
    // Door gap at relX 9-10
    if (relX >= 9 && relX <= 10 && by <= 3) {
      return; // door opening
    }
    chunk.set(lx, py, lz, DRYWALL);
    return;
  }

  // --- Living room furnishings (relZ 1-11) ---

  // Couch (relX 5-8, relZ 5-6, by 2)
  if (by === 2 && relX >= 5 && relX <= 8 && relZ >= 5 && relZ <= 6) {
    chunk.set(lx, py, lz, COUCH_GREEN);
    return;
  }
  // Couch back (by 3, relZ 6)
  if (by === 3 && relX >= 5 && relX <= 8 && relZ === 6) {
    chunk.set(lx, py, lz, COUCH_GREEN);
    return;
  }

  // Coffee table (relX 6-7, relZ 3, by 2)
  if (by === 2 && relX >= 6 && relX <= 7 && relZ === 3) {
    chunk.set(lx, py, lz, FURNITURE_DARK);
    return;
  }

  // Lamp in corner (relX 2, relZ 2, by 2-3)
  if (relX === 2 && relZ === 2 && (by === 2 || by === 3)) {
    chunk.set(lx, py, lz, by === 3 ? LAMP_WARM : FURNITURE_DARK);
    return;
  }

  // --- Kitchen area (relX 12-17, relZ 2-6) ---

  // Kitchen counter (relX 14-17, relZ 2, by 2)
  if (by === 2 && relX >= 14 && relX <= 17 && relZ === 2) {
    chunk.set(lx, py, lz, COUNTER_TOP);
    return;
  }
  // Fridge (relX 17, relZ 4-5, by 2-4)
  if (relX === 17 && relZ >= 4 && relZ <= 5 && by >= 2 && by <= 4) {
    chunk.set(lx, py, lz, APPLIANCE_STEEL);
    return;
  }

  // --- Bedroom (relZ 13-21) ---

  // Bed (relX 3-5, relZ 16-19, by 2)
  if (by === 2 && relX >= 3 && relX <= 5 && relZ >= 16 && relZ <= 19) {
    if (relZ === 16) {
      chunk.set(lx, py, lz, BED_PILLOW); // pillows at head
    } else {
      chunk.set(lx, py, lz, BED_BLUE);
    }
    return;
  }
  // Bed frame head (relX 3-5, relZ 16, by 3)
  if (by === 3 && relX >= 3 && relX <= 5 && relZ === 16) {
    chunk.set(lx, py, lz, FURNITURE_DARK);
    return;
  }

  // Nightstand (relX 2, relZ 17, by 2)
  if (by === 2 && relX === 2 && relZ === 17) {
    chunk.set(lx, py, lz, FURNITURE_DARK);
    return;
  }

  // Bedroom lamp (relX 2, relZ 17, by 3)
  if (by === 3 && relX === 2 && relZ === 17) {
    chunk.set(lx, py, lz, LAMP_WARM);
    return;
  }

  // Dresser (relX 14-16, relZ 20, by 2-3)
  if (relX >= 14 && relX <= 16 && relZ === 20 && (by === 2 || by === 3)) {
    chunk.set(lx, py, lz, FURNITURE_DARK);
    return;
  }
}

/** Place apartment exterior details (welcome mat, awning, sign, path) */
function placeApartmentExterior(
  chunk: ChunkData, lx: number, lz: number,
  wx: number, wz: number, surfaceH: number
): void {
  const relX = wx - APARTMENT_X;

  // Welcome mat right in front of the door (wz = -13, i.e. one voxel in front)
  if (wz === -13 && relX >= 7 && relX <= 12) {
    const py = surfaceH + 1 - chunk.cy * CHUNK_SIZE;
    if (py >= 0 && py < CHUNK_SIZE) {
      chunk.set(lx, py, lz, WELCOME_MAT);
    }
    return;
  }

  // Door frame pillars (relX 7 and 12, wz=-12, by 1-4)
  if (wz === -12 && (relX === 7 || relX === 12)) {
    for (let by = 1; by <= 4; by++) {
      const py = surfaceH + by - chunk.cy * CHUNK_SIZE;
      if (py >= 0 && py < CHUNK_SIZE) {
        chunk.set(lx, py, lz, CONCRETE);
      }
    }
    return;
  }

  // Awning above entrance (relX 7-12, wz=-12 to -13, by 4)
  if ((wz === -12 || wz === -13) && relX >= 7 && relX <= 12) {
    const py = surfaceH + 4 - chunk.cy * CHUNK_SIZE;
    if (py >= 0 && py < CHUNK_SIZE) {
      chunk.set(lx, py, lz, AWNING_DARK);
    }
    return;
  }

  // Sign above awning (relX 8-11, wz=-12, by 5)
  if (wz === -12 && relX >= 8 && relX <= 11) {
    const py = surfaceH + 5 - chunk.cy * CHUNK_SIZE;
    if (py >= 0 && py < CHUNK_SIZE) {
      chunk.set(lx, py, lz, APARTMENT_SIGN);
    }
    return;
  }

  // Sidewalk path leading to door (wz = -14 to -16, relX 8-11)
  if (wz >= -16 && wz <= -14 && relX >= 8 && relX <= 11) {
    const py = surfaceH + 1 - chunk.cy * CHUNK_SIZE;
    if (py >= 0 && py < CHUNK_SIZE) {
      chunk.set(lx, py, lz, SIDEWALK_CONCRETE);
    }
  }
}

/** Place Waffle House landmark */
function placeWaffleHouse(
  chunk: ChunkData, lx: number, lz: number,
  wx: number, wz: number, surfaceH: number
): void {
  const relX = wx - (ZONE3_START + 5);
  const relZ = wz + 15;

  if (relX < 0 || relX >= 15 || relZ < 0 || relZ >= 10) return;

  const whHeight = 5;
  const isEdgeX = relX === 0 || relX === 14;
  const isEdgeZ = relZ === 0 || relZ === 9;
  const isEdge = isEdgeX || isEdgeZ;

  for (let by = 1; by <= whHeight; by++) {
    const py = surfaceH + by - chunk.cy * CHUNK_SIZE;
    if (py < 0 || py >= CHUNK_SIZE) continue;

    if (by === whHeight) {
      // Roof — Waffle House yellow
      chunk.set(lx, py, lz, WAFFLE_HOUSE_YELLOW);
    } else if (isEdge) {
      // Walls — alternating yellow/brown stripe
      if (by >= 3) {
        chunk.set(lx, py, lz, WAFFLE_HOUSE_YELLOW);
      } else {
        chunk.set(lx, py, lz, WAFFLE_HOUSE_BROWN);
      }
      // Windows
      if (by >= 2 && by <= 3 && !isEdgeX && relZ === 0) {
        chunk.set(lx, py, lz, WINDOW_GLASS);
      }
    }
    // Door
    if (by <= 2 && relZ === 0 && relX >= 6 && relX <= 8) {
      chunk.set(lx, py, lz, DOOR_WOOD);
    }
  }
}

/** Place MARTA station entrance (above-ground structure) */
function placeMARTAEntrance(
  chunk: ChunkData, lx: number, lz: number,
  wx: number, wz: number, surfaceH: number
): void {
  // Station entrance near the collapse zone
  const entranceX = 310;
  const entranceZ = -20;

  if (Math.abs(wx - entranceX) > 4 || Math.abs(wz - entranceZ) > 3) return;

  const relX = wx - entranceX + 4;
  const relZ = wz - entranceZ + 3;

  // Small above-ground booth
  const boothH = 4;
  const isEdge = relX === 0 || relX === 8 || relZ === 0 || relZ === 6;

  for (let by = 1; by <= boothH; by++) {
    const py = surfaceH + by - chunk.cy * CHUNK_SIZE;
    if (py < 0 || py >= CHUNK_SIZE) continue;

    if (by === boothH) {
      chunk.set(lx, py, lz, MARTA_BLUE);
    } else if (isEdge) {
      chunk.set(lx, py, lz, MARTA_BLUE);
    }
  }

  // Stairwell going down (carve through surface)
  if (relX >= 2 && relX <= 6 && relZ >= 1 && relZ <= 5) {
    for (let dy = 0; dy >= -10; dy--) {
      const py = surfaceH + dy - chunk.cy * CHUNK_SIZE;
      if (py >= 0 && py < CHUNK_SIZE) {
        chunk.set(lx, py, lz, 0); // carve out air
      }
    }
    // Stairs (alternating blocks going down)
    const stairStep = (relX - 2) * 2;
    for (let s = 0; s < stairStep && s < 8; s++) {
      const py = surfaceH - s - 1 - chunk.cy * CHUNK_SIZE;
      if (py >= 0 && py < CHUNK_SIZE && relZ >= 2 && relZ <= 4) {
        chunk.set(lx, py, lz, CONCRETE);
      }
    }
  }
}

// ── Underground structures (MARTA interior, manholes) ────────────────
function placeUndergroundStructures(
  chunk: ChunkData, lx: number, lz: number,
  wx: number, wz: number
): void {
  // Only process chunks that contain underground voxels
  if (chunk.cy > 0 || chunk.cy < -2) return;

  // ── MARTA Station Interior ──
  const stationCenterX = 310;
  const stationHalfX = 20;
  const stationHalfZ = 12;

  if (Math.abs(wx - stationCenterX) <= stationHalfX && Math.abs(wz) <= stationHalfZ) {
    const absZ = Math.abs(wz);
    const platformFloorY = SEWER_FLOOR_Y + 4; // -16, one above station floor

    // Platform areas: |wz| >= 4 (raised walkways on either side of tracks)
    const isPlatformZ = absZ >= 4;
    const isTrackZ = absZ < 4;

    if (isPlatformZ) {
      // Platform surface (2 blocks tall, raised above track level)
      for (let py = 0; py < 2; py++) {
        const wy = platformFloorY + py;
        const ly = wy - chunk.cy * CHUNK_SIZE;
        if (ly < 0 || ly >= CHUNK_SIZE) continue;

        if (py === 1) {
          // Top surface
          if (absZ === 4) {
            // Yellow safety edge along platform
            chunk.set(lx, ly, lz, CONSTRUCTION_YELLOW);
          } else {
            chunk.set(lx, ly, lz, MARTA_PLATFORM);
          }
        } else {
          // Platform base
          chunk.set(lx, ly, lz, CONCRETE);
        }
      }

      // Support columns every 10 blocks along X
      if (wx % 10 === 0 && (absZ === 5 || absZ === 11)) {
        const stationCeil = GROUND_Y - 6;
        for (let wy = platformFloorY + 2; wy < stationCeil; wy++) {
          const ly = wy - chunk.cy * CHUNK_SIZE;
          if (ly >= 0 && ly < CHUNK_SIZE) {
            chunk.set(lx, ly, lz, CONCRETE);
          }
        }
      }

      // Subway tile walls along station edges
      if (absZ >= 11) {
        for (let wy = platformFloorY + 2; wy < GROUND_Y - 7; wy++) {
          const ly = wy - chunk.cy * CHUNK_SIZE;
          if (ly >= 0 && ly < CHUNK_SIZE) {
            chunk.set(lx, ly, lz, SUBWAY_TILE);
          }
        }
      }

      // MARTA blue accent stripe at eye level on walls
      if (absZ === 12) {
        const stripeY = platformFloorY + 4;
        const ly = stripeY - chunk.cy * CHUNK_SIZE;
        if (ly >= 0 && ly < CHUNK_SIZE) {
          chunk.set(lx, ly, lz, MARTA_BLUE);
        }
      }
    }

    if (isTrackZ) {
      // Rails on the track bed (two rail lines at Z = ±1 and ±3)
      const railY = SEWER_FLOOR_Y + 4; // Station floor + 1
      const ly = railY - chunk.cy * CHUNK_SIZE;
      if (ly >= 0 && ly < CHUNK_SIZE) {
        if (absZ === 1 || absZ === 3) {
          chunk.set(lx, ly, lz, MARTA_TRACK_RAIL);
        }
      }
    }

    // Stopped MARTA train car (centered in station, occupying part of the tracks)
    const trainStartX = stationCenterX - 12;
    const trainEndX = stationCenterX + 8;
    if (wx >= trainStartX && wx < trainEndX && absZ <= 3) {
      const trainFloor = SEWER_FLOOR_Y + 5; // Just above rails
      const trainH = 4; // Train is 4 blocks tall

      for (let ty = 0; ty < trainH; ty++) {
        const wy = trainFloor + ty;
        const ly = wy - chunk.cy * CHUNK_SIZE;
        if (ly < 0 || ly >= CHUNK_SIZE) continue;

        const isTrainEdgeX = wx === trainStartX || wx === trainEndX - 1;
        const isTrainEdgeZ = absZ === 3;
        const isTrainEdge = isTrainEdgeX || isTrainEdgeZ;

        if (ty === 0) {
          // Train floor
          chunk.set(lx, ly, lz, MARTA_TRAIN_BODY);
        } else if (ty === trainH - 1) {
          // Train roof
          chunk.set(lx, ly, lz, MARTA_TRAIN_BODY);
        } else if (isTrainEdge) {
          // Train walls
          if (ty === 2 && !isTrainEdgeX && wx % 3 !== 0) {
            // Windows in the middle section (not at ends, not every 3rd)
            chunk.set(lx, ly, lz, WINDOW_GLASS);
          } else {
            chunk.set(lx, ly, lz, MARTA_TRAIN_BODY);
          }
          // Gold stripe at base of walls
          if (ty === 1 && isTrainEdgeZ) {
            chunk.set(lx, ly, lz, MARTA_TRAIN_STRIPE);
          }
        }
        // Interior of train is air (doors would go here)
        if (isTrainEdgeZ && (wx === trainStartX + 3 || wx === trainEndX - 4)) {
          if (ty >= 1 && ty < trainH - 1) {
            chunk.set(lx, ly, lz, 0); // Door openings
          }
        }
      }
    }
  }

  // ── Manhole shaft surface structures ──
  for (const [mx, mz] of MANHOLE_SHAFTS) {
    if (Math.abs(wx - mx) <= 2 && Math.abs(wz - mz) <= 2) {
      const surfaceH = getSurfaceHeight(wx, wz);
      // Manhole cover ring at surface level
      if (Math.abs(wx - mx) <= 1 && Math.abs(wz - mz) <= 1) {
        const coverY = surfaceH + 1;
        const ly = coverY - chunk.cy * CHUNK_SIZE;
        if (ly >= 0 && ly < CHUNK_SIZE) {
          if (Math.abs(wx - mx) === 1 || Math.abs(wz - mz) === 1) {
            chunk.set(lx, ly, lz, MANHOLE_FRAME);
          }
        }
      }
    }
  }

  // ── Sewer grate floor sections in tunnel junctions ──
  // At junction chambers, place grate floor for visual variety
  if (wx % 60 < 8 && wx % 60 >= 0 && wx > COLLAPSE_START - 40 && wx < ZONE3_START + 60) {
    const junctionFloorY = SEWER_FLOOR_Y + 1;
    const ly = junctionFloorY - chunk.cy * CHUNK_SIZE;
    if (ly >= 0 && ly < CHUNK_SIZE && Math.abs(wz) < TUNNEL_RADIUS + 3) {
      const r = rand2(wx + 700, wz + 800);
      if (r < 0.3) {
        chunk.set(lx, ly, lz, 164); // sewer_grate_floor
      }
    }
  }
}

// ── Street trees (placed along sidewalks in Zone 3) ─────────────────
function placeStreetTree(
  chunk: ChunkData, lx: number, lz: number,
  wx: number, wz: number, surfaceH: number
): void {
  const { isSidewalk, isStreet, gridX, gridZ } = getStreetGrid(wx, wz);
  if (!isSidewalk || isStreet) return;
  // Don't place too close to building interiors
  if (gridX > STREET_WIDTH + 3 && gridX < BLOCK_SIZE - 3 &&
      gridZ > STREET_WIDTH + 3 && gridZ < BLOCK_SIZE - 3) return;

  // Trees every ~15 voxels along sidewalks
  if (rand2(wx * 3 + 99, wz * 5 + 33) > 0.04) return;

  const trunkH = 3 + Math.floor(rand2(wx + 50, wz + 50) * 2);
  const crownR = 2;

  for (let ty = 1; ty <= trunkH; ty++) {
    const py = surfaceH + ty - chunk.cy * CHUNK_SIZE;
    if (py >= 0 && py < CHUNK_SIZE) {
      chunk.set(lx, py, lz, TREE_TRUNK);
    }
  }
  for (let dx = -crownR; dx <= crownR; dx++) {
    for (let dz = -crownR; dz <= crownR; dz++) {
      for (let dy = 0; dy <= crownR; dy++) {
        if (dx * dx + dy * dy + dz * dz > crownR * crownR + 1) continue;
        const px = lx + dx;
        const pz = lz + dz;
        const py = surfaceH + trunkH + dy - chunk.cy * CHUNK_SIZE;
        if (px >= 0 && px < CHUNK_SIZE && pz >= 0 && pz < CHUNK_SIZE &&
            py >= 0 && py < CHUNK_SIZE) {
          if (chunk.get(px, py, pz) === 0) {
            chunk.set(px, py, pz, TREE_LEAVES);
          }
        }
      }
    }
  }
}

// ── Street parked cars (along city streets) ─────────────────────────
function placeStreetCar(
  chunk: ChunkData, lx: number, lz: number,
  wx: number, wz: number, surfaceH: number
): void {
  const { isStreetX, isStreetZ, gridX, gridZ, isIntersection } = getStreetGrid(wx, wz);
  if (isIntersection) return; // no cars in intersections

  // Cars parked along the edges of streets (parallel parking)
  const isStreetEdgeX = isStreetX && (gridX === 1 || gridX === STREET_WIDTH - 2);
  const isStreetEdgeZ = isStreetZ && (gridZ === 1 || gridZ === STREET_WIDTH - 2);

  if (!isStreetEdgeX && !isStreetEdgeZ) return;

  // Sparse placement: ~20% chance per 8-voxel slot
  const carSlot = isStreetEdgeX ? Math.floor(wz / 8) : Math.floor(wx / 8);
  const r = rand2(carSlot * 11 + wx * 3 + 2000, (isStreetEdgeX ? gridX : gridZ) * 7 + 700);
  if (r > 0.20) return;

  // Only at the car slot origin
  const originCheck = isStreetEdgeX ? (wz % 8 === 0) : (wx % 8 === 0);
  if (!originCheck) return;

  const carColor = CAR_COLORS[Math.floor(rand2(wx + 500, wz + 888) * CAR_COLORS.length)];
  const carLen = 6;
  const carWid = 3;
  const carH = 3;

  for (let cx = 0; cx < carLen; cx++) {
    for (let cz = 0; cz < carWid; cz++) {
      for (let cy = 0; cy < carH; cy++) {
        const px = isStreetEdgeZ ? lx + cx : lx;
        const pz = isStreetEdgeX ? lz + cx : lz;
        const dxOff = isStreetEdgeZ ? 0 : cz;
        const dzOff = isStreetEdgeX ? 0 : cz;

        const finalPx = px + dxOff;
        const finalPz = pz + dzOff;
        const finalPy = surfaceH + 1 + cy - chunk.cy * CHUNK_SIZE;

        if (finalPx < 0 || finalPx >= CHUNK_SIZE || finalPz < 0 || finalPz >= CHUNK_SIZE ||
            finalPy < 0 || finalPy >= CHUNK_SIZE) continue;

        if (cy === 0 && (cx === 0 || cx === carLen - 1) && (cz === 0 || cz === carWid - 1)) {
          chunk.set(finalPx, finalPy, finalPz, TIRE);
        } else if (cy === 0) {
          chunk.set(finalPx, finalPy, finalPz, carColor);
        } else if (cy === carH - 1) {
          chunk.set(finalPx, finalPy, finalPz, cx >= 1 && cx <= carLen - 2 ? GLASS_WINDSHIELD : carColor);
        } else if (cz === 0 || cz === carWid - 1 || cx === 0 || cx === carLen - 1) {
          chunk.set(finalPx, finalPy, finalPz, carColor);
        } else {
          chunk.set(finalPx, finalPy, finalPz, CAR_INTERIOR);
        }
      }
    }
  }
}

// ── The Varsity — Atlanta's iconic drive-in restaurant ──────────────
function placeVarsity(
  chunk: ChunkData, lx: number, lz: number,
  wx: number, wz: number, surfaceH: number
): void {
  const relX = wx - VARSITY_X;
  const relZ = wz - VARSITY_Z;

  if (relX < 0 || relX >= VARSITY_W || relZ < 0 || relZ >= VARSITY_D) return;

  const bldgH = 7;
  const isEdgeX = relX === 0 || relX === VARSITY_W - 1;
  const isEdgeZ = relZ === 0 || relZ === VARSITY_D - 1;
  const isEdge = isEdgeX || isEdgeZ;

  for (let by = 1; by <= bldgH; by++) {
    const py = surfaceH + by - chunk.cy * CHUNK_SIZE;
    if (py < 0 || py >= CHUNK_SIZE) continue;

    if (by === bldgH) {
      // Roof — red with cream trim at edges
      chunk.set(lx, py, lz, isEdge ? VARSITY_CREAM : VARSITY_RED);
    } else if (isEdge) {
      // Walls
      if (by <= 2) {
        chunk.set(lx, py, lz, VARSITY_RED);
      } else {
        chunk.set(lx, py, lz, VARSITY_CREAM);
      }
      // Large windows along front (relZ === 0)
      if (by >= 2 && by <= 4 && relZ === 0 && relX >= 3 && relX < VARSITY_W - 3) {
        chunk.set(lx, py, lz, WINDOW_GLASS);
      }
      // Side windows
      if (by >= 3 && by <= 4 && isEdgeX && relZ >= 3 && relZ % 3 === 0) {
        chunk.set(lx, py, lz, WINDOW_GLASS);
      }
    } else {
      // Interior: counter area
      if (by === 1 && relX >= 3 && relX < VARSITY_W - 3 && relZ === 3) {
        chunk.set(lx, py, lz, COUNTER_TOP);
      }
    }

    // Front door — double wide
    if (by <= 2 && relZ === 0 && relX >= 8 && relX <= 11) {
      chunk.set(lx, py, lz, DOOR_METAL);
    }
  }

  // "V" shaped awning above entrance
  if (relZ === 0 && relX >= 6 && relX <= 13) {
    const awningY = surfaceH + bldgH + 1 - chunk.cy * CHUNK_SIZE;
    if (awningY >= 0 && awningY < CHUNK_SIZE) {
      chunk.set(lx, awningY, lz, VARSITY_RED);
    }
  }
}

// ── Parking garage (multi-level open structure) ─────────────────────
function placeParkingGarage(
  chunk: ChunkData, lx: number, lz: number,
  wx: number, wz: number, surfaceH: number
): void {
  const relX = wx - GARAGE_X;
  const relZ = wz - GARAGE_Z;

  if (relX < 0 || relX >= GARAGE_W || relZ < 0 || relZ >= GARAGE_D) return;

  const numFloors = 4;
  const floorH = 5; // 5 voxels per floor
  const totalH = numFloors * floorH;

  const isEdgeX = relX === 0 || relX === GARAGE_W - 1;
  const isEdgeZ = relZ === 0 || relZ === GARAGE_D - 1;
  const isEdge = isEdgeX || isEdgeZ;

  // Structural columns at corners and every 6 blocks
  const isColumn = (relX % 6 === 0 || relX === GARAGE_W - 1) &&
                   (relZ % 8 === 0 || relZ === GARAGE_D - 1);

  for (let by = 1; by <= totalH; by++) {
    const py = surfaceH + by - chunk.cy * CHUNK_SIZE;
    if (py < 0 || py >= CHUNK_SIZE) continue;

    const floorIndex = Math.floor((by - 1) / floorH);
    const levelInFloor = (by - 1) % floorH;

    // Floor slabs
    if (levelInFloor === 0) {
      chunk.set(lx, py, lz, PARKING_CONCRETE);
      continue;
    }

    // Structural columns go full height
    if (isColumn && levelInFloor > 0) {
      chunk.set(lx, py, lz, CONCRETE);
      continue;
    }

    // Half-height perimeter wall (barrier) on each floor
    if (isEdge && levelInFloor <= 2) {
      chunk.set(lx, py, lz, CONCRETE);
    }

    // Entrance opening on ground floor (front face)
    if (floorIndex === 0 && relZ === 0 && relX >= 4 && relX < GARAGE_W - 4 && levelInFloor <= 3) {
      chunk.set(lx, py, lz, 0); // carve opening
    }

    // Ramp between floors (diagonal surface along Z edge)
    if (relX >= GARAGE_W - 3 && relZ >= 2 && relZ < GARAGE_D - 2) {
      const rampProgress = relZ / GARAGE_D;
      const rampY = Math.floor(rampProgress * floorH);
      if (levelInFloor === rampY) {
        chunk.set(lx, py, lz, PARKING_CONCRETE);
      }
    }
  }

  // Top floor = open roof
  const roofPy = surfaceH + totalH + 1 - chunk.cy * CHUNK_SIZE;
  if (roofPy >= 0 && roofPy < CHUNK_SIZE && isEdge) {
    chunk.set(lx, roofPy, lz, CONCRETE);
  }
}

// ── Construction zone (final boss arena area) ───────────────────────
function placeConstructionZone(
  chunk: ChunkData, lx: number, lz: number,
  wx: number, wz: number, surfaceH: number
): void {
  const relX = wx - CONSTRUCTION_X;
  const relZ = wz - CONSTRUCTION_Z;

  if (relX < 0 || relX >= CONSTRUCTION_W || relZ < 0 || relZ >= CONSTRUCTION_D) return;

  // Concrete barriers around the perimeter
  const isPerimeter = relX === 0 || relX === CONSTRUCTION_W - 1 ||
                      relZ === 0 || relZ === CONSTRUCTION_D - 1;

  if (isPerimeter) {
    for (let by = 1; by <= 2; by++) {
      const py = surfaceH + by - chunk.cy * CHUNK_SIZE;
      if (py >= 0 && py < CHUNK_SIZE) {
        chunk.set(lx, py, lz, by === 1 ? CONCRETE : CONSTRUCTION_YELLOW);
      }
    }
    // Gaps for entry
    if (relZ === 0 && relX >= 10 && relX <= 14) return;
    return;
  }

  // Scaffolding structures at specific positions
  const hasScaffolding = (relX % 8 < 2 && relZ % 10 < 2) && relX > 2 && relZ > 2;
  if (hasScaffolding) {
    for (let by = 1; by <= 15; by++) {
      const py = surfaceH + by - chunk.cy * CHUNK_SIZE;
      if (py >= 0 && py < CHUNK_SIZE) {
        if (by % 5 === 0) {
          chunk.set(lx, py, lz, STEEL_STRUCTURAL); // platform
        } else {
          chunk.set(lx, py, lz, SCAFFOLDING); // vertical poles
        }
      }
    }
    return;
  }

  // Construction crane (tall, at center)
  const craneX = Math.floor(CONSTRUCTION_W / 2);
  const craneZ = Math.floor(CONSTRUCTION_D / 2);
  if (Math.abs(relX - craneX) <= 1 && Math.abs(relZ - craneZ) <= 1) {
    // Crane base/tower
    for (let by = 1; by <= 30; by++) {
      const py = surfaceH + by - chunk.cy * CHUNK_SIZE;
      if (py >= 0 && py < CHUNK_SIZE) {
        chunk.set(lx, py, lz, CRANE_YELLOW);
      }
    }
    return;
  }
  // Crane arm (horizontal at top, extending in +X)
  if (relZ === craneZ && relX > craneX && relX < CONSTRUCTION_W - 2) {
    const armY = surfaceH + 30 - chunk.cy * CHUNK_SIZE;
    if (armY >= 0 && armY < CHUNK_SIZE) {
      chunk.set(lx, armY, lz, CRANE_YELLOW);
    }
    // Support cables
    const cableY = surfaceH + 29 - chunk.cy * CHUNK_SIZE;
    if (cableY >= 0 && cableY < CHUNK_SIZE && relX % 3 === 0) {
      chunk.set(lx, cableY, lz, STEEL_STRUCTURAL);
    }
  }

  // Scattered construction materials on the ground
  const matR = rand2(wx + 333, wz + 444);
  if (matR < 0.03) {
    const py = surfaceH + 1 - chunk.cy * CHUNK_SIZE;
    if (py >= 0 && py < CHUNK_SIZE) {
      chunk.set(lx, py, lz, matR < 0.015 ? CONSTRUCTION_ORANGE : STEEL_STRUCTURAL);
    }
  }

  // Concrete barriers scattered inside
  if (rand2(wx + 555, wz + 666) < 0.02) {
    for (let by = 1; by <= 2; by++) {
      const py = surfaceH + by - chunk.cy * CHUNK_SIZE;
      if (py >= 0 && py < CHUNK_SIZE) {
        chunk.set(lx, py, lz, CONCRETE);
      }
    }
  }
}
