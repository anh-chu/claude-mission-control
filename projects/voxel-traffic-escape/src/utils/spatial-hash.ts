/**
 * 2D spatial hash grid for efficient broad-phase collision queries.
 * Entities are bucketed by their XZ position into fixed-size grid cells.
 * Querying a radius only checks the overlapping cells instead of all entities.
 *
 * Performance crossover: spatial hashing outperforms linear scan when
 * entity count exceeds ~20-30 for typical query radii. Below that,
 * the Map/Set overhead makes linear scan faster.
 */

export interface Positioned {
  readonly position: { readonly x: number; readonly z: number };
}

export class SpatialHash<T extends Positioned> {
  private cellSize: number;
  private invCellSize: number;
  private cells: Map<number, T[]> = new Map();
  private entityCells: Map<T, number> = new Map();

  constructor(cellSize = 8) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
  }

  /** Compute a unique integer key from grid coordinates */
  private cellKey(cx: number, cz: number): number {
    // Shift to positive range and combine — supports coords from -32768 to 32767
    return ((cx + 32768) << 16) | ((cz + 32768) & 0xffff);
  }

  /** Insert an entity into the grid */
  insert(entity: T): void {
    const cx = Math.floor(entity.position.x * this.invCellSize);
    const cz = Math.floor(entity.position.z * this.invCellSize);
    const key = this.cellKey(cx, cz);

    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(entity);
    this.entityCells.set(entity, key);
  }

  /** Remove an entity from the grid */
  remove(entity: T): void {
    const key = this.entityCells.get(entity);
    if (key === undefined) return;

    const cell = this.cells.get(key);
    if (cell) {
      const idx = cell.indexOf(entity);
      if (idx !== -1) {
        // Swap-remove for O(1)
        cell[idx] = cell[cell.length - 1];
        cell.pop();
      }
      if (cell.length === 0) {
        this.cells.delete(key);
      }
    }
    this.entityCells.delete(entity);
  }

  /** Update an entity's cell if it has moved */
  update(entity: T): void {
    const cx = Math.floor(entity.position.x * this.invCellSize);
    const cz = Math.floor(entity.position.z * this.invCellSize);
    const newKey = this.cellKey(cx, cz);

    const oldKey = this.entityCells.get(entity);
    if (oldKey === newKey) return; // hasn't crossed a cell boundary

    this.remove(entity);
    this.insert(entity);
  }

  /**
   * Query all entities within a radius of a point (XZ plane).
   * Returns entities from all cells that overlap the query circle.
   * Caller should do a precise distance check on the results.
   */
  query(x: number, z: number, radius: number, results: T[]): void {
    results.length = 0;

    const minCx = Math.floor((x - radius) * this.invCellSize);
    const maxCx = Math.floor((x + radius) * this.invCellSize);
    const minCz = Math.floor((z - radius) * this.invCellSize);
    const maxCz = Math.floor((z + radius) * this.invCellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const cell = this.cells.get(this.cellKey(cx, cz));
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            results.push(cell[i]);
          }
        }
      }
    }
  }

  /** Clear all entries */
  clear(): void {
    this.cells.clear();
    this.entityCells.clear();
  }

  /** Number of tracked entities */
  get size(): number {
    return this.entityCells.size;
  }
}
