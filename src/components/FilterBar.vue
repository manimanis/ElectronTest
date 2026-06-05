<script setup>
/**
 * FilterBar.vue
 * Provides search input and extension filter for filtering folder contents
 */
const search = defineModel('search')
const extension = defineModel('extension')
</script>

<template>
  <div class="filter-bar">
    <div class="filter-group">
      <label class="filter-label" for="search-input">🔍 Filter by name</label>
      <input
        id="search-input"
        v-model="search"
        type="text"
        class="filter-input"
        placeholder="Search files and folders..."
        autocomplete="off"
      />
      <button
        v-if="search"
        class="clear-btn"
        @click="search = ''"
        title="Clear search"
      >
        ×
      </button>
    </div>

    <div class="filter-group">
      <label class="filter-label" for="ext-input">📄 Filter by extension</label>
      <div class="ext-input-wrapper">
        <span class="ext-prefix">.</span>
        <input
          id="ext-input"
          v-model="extension"
          type="text"
          class="filter-input ext-input"
          placeholder="e.g. js, vue, txt"
          autocomplete="off"
        />
        <button
          v-if="extension"
          class="clear-btn"
          @click="extension = ''"
          title="Clear extension filter"
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.filter-group {
  flex: 1;
  min-width: 200px;
  position: relative;
}

.filter-label {
  display: block;
  font-size: 0.8rem;
  color: #888;
  margin-bottom: 6px;
  font-weight: 500;
}

.filter-input {
  width: 100%;
  padding: 10px 14px;
  background: #12121f;
  border: 1px solid #2a2a3e;
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}

.filter-input:focus {
  border-color: #6c63ff;
  box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.15);
}

.filter-input::placeholder {
  color: #555;
}

.ext-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.ext-prefix {
  position: absolute;
  left: 12px;
  color: #666;
  font-size: 0.9rem;
  z-index: 1;
  font-weight: 700;
}

.ext-input-wrapper .ext-input {
  padding-left: 28px;
}

.clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #666;
  font-size: 1.4rem;
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
  transition: color 0.2s;
}

.clear-btn:hover {
  color: #e74c3c;
}
</style>