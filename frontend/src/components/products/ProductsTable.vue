<script setup>
import { computed, ref } from "vue";
import { Edit, InfoFilled } from "@element-plus/icons-vue";
import { useViewportBreakpoint } from "@/composables/useViewportBreakpoint";

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
const isCompact = useViewportBreakpoint(900);

const tableRef = ref(null);
defineExpose({
  getTable: () => tableRef.value,
});

const indexMethod = (index) =>
  (Number(props.query.page) - 1) * Number(props.query.page_size) + index + 1;

const mobileItems = computed(() =>
  (props.items || []).map((item, index) => ({
    ...item,
    rowIndex: indexMethod(index),
  })),
);
</script>

<template>
  <el-card class="card table-card">
    <div v-if="!isCompact" class="table-shell">
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
    <div v-else class="mobile-products-list" v-loading="loading">
      <el-empty v-if="!mobileItems.length" description="暂无产品数据" />
      <article v-for="item in mobileItems" :key="item.id" class="mobile-product-card">
        <header class="mobile-product-head">
          <span class="mobile-product-name">{{ item.name }}</span>
          <el-tag v-if="!item.is_deleted" type="success">启用</el-tag>
          <el-tag v-else type="info">已作废</el-tag>
        </header>
        <div class="mobile-product-meta">
          <span>序号 {{ item.rowIndex }}</span>
          <span>品类 {{ item.category_name || "-" }}</span>
          <span>单位 {{ item.unit || "-" }}</span>
        </div>
        <div class="mobile-product-grid">
          <div>单价：{{ item.base_price ?? "-" }}</div>
          <div>波动：{{ formatVolatility(item.volatility) }}</div>
          <div>数量范围：{{ formatRange(item.item_quantity_range) }}</div>
          <div>更新时间：{{ formatDateTime(item.updated_at) }}</div>
        </div>
        <footer class="mobile-product-actions">
          <el-button type="primary" plain @click="emit('edit', item)">
            编辑
            <el-icon class="el-icon--right"><Edit /></el-icon>
          </el-button>
          <el-button
            v-if="item.is_deleted"
            type="success"
            plain
            @click="emit('restore', item)"
          >
            启用
          </el-button>
          <el-button v-else type="danger" plain @click="emit('delete', item)">
            作废
          </el-button>
        </footer>
      </article>
    </div>
    <div class="pager">
      <div class="pager-total">共 {{ total }} 条</div>
      <el-pagination
        :layout="isCompact ? 'prev, next' : 'prev, pager, next'"
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

.mobile-products-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mobile-product-card {
  border: 1px solid rgba(201, 164, 74, 0.22);
  border-radius: 14px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.72);
  display: grid;
  gap: 8px;
}

.mobile-product-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mobile-product-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
}

.mobile-product-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: var(--muted);
  font-size: 12px;
}

.mobile-product-grid {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: var(--ink);
}

.mobile-product-actions {
  display: flex;
  gap: 10px;
}
</style>
