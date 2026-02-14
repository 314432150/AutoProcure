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
      <el-input
        v-model="query.keyword"
        placeholder="搜索名称"
        clearable
        @input="emit('keyword-input')"
      />
      <el-select v-model="query.category_id" placeholder="品类" clearable>
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
        style="width: 120px"
      >
        <el-option :value="true" label="启用" />
        <el-option :value="false" label="已作废" />
      </el-select>
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
  </el-card>
</template>
