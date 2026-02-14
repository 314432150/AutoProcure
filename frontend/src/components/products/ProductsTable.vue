<script setup>
import { ref } from "vue";
import { Edit, InfoFilled } from "@element-plus/icons-vue";

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  query: {
    type: Object,
    required: true,
  },
  total: {
    type: Number,
    default: 0,
  },
  volatilityTooltip: {
    type: String,
    default: "",
  },
  quantityRuleTooltip: {
    type: String,
    default: "",
  },
  unitTooltip: {
    type: String,
    default: "",
  },
  formatVolatility: {
    type: Function,
    required: true,
  },
  formatRange: {
    type: Function,
    required: true,
  },
  formatDateTime: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits([
  "edit",
  "sort-change",
  "delete",
  "restore",
  "page-change",
]);

const tableRef = ref(null);
defineExpose({
  getTable: () => tableRef.value,
});

const indexMethod = (index) =>
  (Number(props.query.page) - 1) * Number(props.query.page_size) + index + 1;
</script>

<template>
  <el-card class="card table-card">
    <div class="table-shell">
      <el-table
        ref="tableRef"
        :data="items"
        v-loading="loading"
        stripe
        height="100%"
        @row-dblclick="(row) => emit('edit', row)"
        @sort-change="(payload) => emit('sort-change', payload)"
      >
        <el-table-column
          type="index"
          label="序号"
          width="70"
          :index="indexMethod"
          fixed="left"
        />
        <el-table-column
          prop="name"
          label="名称"
          min-width="160"
          sortable
          fixed="left"
        >
          <template #default="scope">
            <span class="row-edit-hint">
              {{ scope.row.name }}
              <el-tooltip content="双击编辑" placement="top">
                <el-icon class="row-edit-icon row-edit-icon--strong">
                  <Edit />
                </el-icon>
              </el-tooltip>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="category_name" label="品类" width="140" sortable />
        <el-table-column
          prop="base_price"
          label="单价(元)"
          width="140"
          sortable
        />
        <el-table-column label="单价波动" width="140" prop="volatility" sortable>
          <template #header>
            <span class="th-with-tip">
              单价波动
              <el-tooltip :content="volatilityTooltip" placement="top">
                <el-icon class="th-tip">
                  <InfoFilled />
                </el-icon>
              </el-tooltip>
            </span>
          </template>
          <template #default="scope">
            {{ formatVolatility(scope.row.volatility) }}
          </template>
        </el-table-column>
        <el-table-column label="采购数量范围" width="140">
          <template #header>
            <span class="th-with-tip">
              采购数量范围
              <el-tooltip :content="quantityRuleTooltip" placement="top">
                <el-icon class="th-tip">
                  <InfoFilled />
                </el-icon>
              </el-tooltip>
            </span>
          </template>
          <template #default="scope">
            {{ formatRange(scope.row.item_quantity_range) }}
          </template>
        </el-table-column>
        <el-table-column prop="unit" width="100">
          <template #header>
            <span class="th-with-tip">
              单位
              <el-tooltip :content="unitTooltip" placement="top">
                <el-icon class="th-tip">
                  <InfoFilled />
                </el-icon>
              </el-tooltip>
            </span>
          </template>
          <template #default="scope">
            {{ scope.row.unit || "-" }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" prop="status" sortable>
          <template #default="scope">
            <el-tag v-if="!scope.row.is_deleted" type="success">启用</el-tag>
            <el-tag v-else type="info">已作废</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="180" prop="updated_at" sortable>
          <template #default="scope">
            {{ formatDateTime(scope.row.updated_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="scope">
            <el-button
              v-if="scope.row.is_deleted"
              type="success"
              link
              @click="emit('restore', scope.row)"
            >
              启用
            </el-button>
            <el-button
              v-else
              type="danger"
              link
              @click="emit('delete', scope.row)"
            >
              作废
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <div class="pager">
      <div class="pager-total">共 {{ total }} 条</div>
      <el-pagination
        layout="prev, pager, next"
        :page-size="query.page_size"
        :total="total"
        v-model:current-page="query.page"
        @current-change="emit('page-change')"
      />
    </div>
  </el-card>
</template>

<style scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pager-total {
  color: #666;
  font-size: 12px;
}
</style>
