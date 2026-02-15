<script setup>
import { ArrowDown } from "@element-plus/icons-vue";

defineProps({
  query: {
    type: Object,
    required: true,
  },
  categories: {
    type: Array,
    default: () => [],
  },
  exportLoading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "search",
  "create",
  "batch",
  "import",
  "export",
  "keyword-input",
]);

const onMoreCommand = (command) => {
  if (command === "batch") emit("batch");
  if (command === "import") emit("import");
  if (command === "export") emit("export");
};
</script>

<template>
  <el-card class="card form-card">
    <div class="toolbar">
      <div class="toolbar-filters">
        <el-input
          v-model="query.keyword"
          placeholder="搜索名称"
          clearable
          class="keyword-input"
          @input="emit('keyword-input')"
        />
        <el-select v-model="query.category_id" placeholder="品类" clearable class="category-select">
          <el-option
            v-for="item in categories"
            :key="item.id"
            :value="item.id"
            :label="item.is_active ? item.name : `${item.name}（已作废）`"
          />
        </el-select>
        <el-select
          v-model="query.is_active"
          placeholder="状态"
          clearable
          class="status-select"
        >
          <el-option :value="true" label="启用" />
          <el-option :value="false" label="已作废" />
        </el-select>
      </div>
      <div class="toolbar-actions">
        <el-button type="primary" @click="emit('search')">查询</el-button>
        <el-button type="primary" plain @click="emit('create')">
          新增产品
        </el-button>
        <el-dropdown @command="onMoreCommand">
          <el-button type="primary" plain :loading="exportLoading">
            更多操作
            <el-icon class="el-icon--right">
              <ArrowDown />
            </el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="batch">
                批量设置
              </el-dropdown-item>
              <el-dropdown-item command="import">
                导入Excel
              </el-dropdown-item>
              <el-dropdown-item
                command="export"
                :disabled="exportLoading"
              >
                导出Excel
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.toolbar-filters {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
  justify-content: flex-start;
}

.keyword-input {
  width: 200px;
}

.category-select {
  width: 200px;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
}

.status-select {
  width: 120px;
}

@media (max-width: 900px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-actions {
    width: 100%;
  }

  .toolbar-filters {
    flex-direction: column;
    align-items: stretch;
  }

  .keyword-input,
  .category-select {
    width: 100%;
  }

  .toolbar-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .toolbar-actions :deep(.el-dropdown),
  .toolbar-actions :deep(.el-dropdown .el-button) {
    width: 100%;
  }

  .status-select {
    width: 100%;
  }
}
</style>
