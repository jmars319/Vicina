import {
  areaOptions,
  categoryOptions,
  radiusOptions,
  sortOptions,
  timeOptions,
  type CategoryFilter,
  type SignalFilters as SignalFiltersValue,
  type SignalSort,
  type TimeFilter
} from "@/lib/mock/signals";

interface SignalFiltersProps {
  filters: SignalFiltersValue;
  onChange: (filters: SignalFiltersValue) => void;
}

export function SignalFilters({ filters, onChange }: SignalFiltersProps) {
  return (
    <div className="filters" aria-label="Signal filters">
      <label>
        <span>Area</span>
        <select
          onChange={(event) => onChange({ ...filters, areaId: event.target.value })}
          value={filters.areaId}
        >
          {areaOptions.map((area) => (
            <option key={area.id} value={area.id}>
              {area.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Distance</span>
        <select
          onChange={(event) =>
            onChange({ ...filters, radiusMiles: Number(event.target.value) as 1 | 3 | 5 | 10 })
          }
          value={filters.radiusMiles}
        >
          {radiusOptions.map((radius) => (
            <option key={radius} value={radius}>
              {radius} miles
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Category</span>
        <select
          onChange={(event) =>
            onChange({ ...filters, category: event.target.value as CategoryFilter })
          }
          value={filters.category}
        >
          {categoryOptions.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Time</span>
        <select
          onChange={(event) => onChange({ ...filters, time: event.target.value as TimeFilter })}
          value={filters.time}
        >
          {timeOptions.map((time) => (
            <option key={time.value} value={time.value}>
              {time.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Sort</span>
        <select
          onChange={(event) => onChange({ ...filters, sort: event.target.value as SignalSort })}
          value={filters.sort}
        >
          {sortOptions.map((sort) => (
            <option key={sort.value} value={sort.value}>
              {sort.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
