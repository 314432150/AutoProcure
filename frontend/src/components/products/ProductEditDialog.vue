<script setup>
import { InfoFilled } from "@element-plus/icons-vue";
import { useViewportBreakpoint } from "@/composables/useViewportBreakpoint";

const isCompact = useViewportBreakpoint(900);
defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  mode: {
    type: String,
    default: "create",
  },
  editForm: {
    type: Object,
    required: true,
  },
  editErrors: {
    type: Object,
    required: true,
  },
  categories: {
    type: Array,
    default: () => [],
  },
  nameChecking: {
    type: Boolean,
    default: false,
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
  editQuantityStep: {
    type: Number,
    default: 1,
  },
});

const emit = defineEmits([
  "update:open",
  "save",
  "name-blur",
  "validate-category",
  "validate-base-price",
  "validate-volatility",
  "validate-item-range",
  "unit-blur",
]);
</script>

<template>
  <el-dialog
    :model-value="open"
    :title="mode === 'create' ? '新增产品' : '修改产品'"
    :width="isCompact ? '92vw' : '520px'"
    class="product-dialog"
    @update:model-value="(value) => emit('update:open', value)"
  >
    <el-form :label-position="isCompact ? 'top' : 'left'" :label-width="isCompact ? 'auto' : '120px'" class="product-edit-form">
      <el-form-item label="名称">
        <el-input
          v-model="editForm.name"
          placeholder="请输入产品名称"
          @blur="emit('name-blur')"
        />
        <div v-if="nameChecking" class="field-muted">正在校验名称...</div>
        <div v-if="editErrors.name" class="field-error">
          {{ editErrors.name }}
        </div>
      </el-form-item>
      <el-form-item label="品类">
        <el-select
          v-model="editForm.category_id"
          placeholder="请选择品类"
          @change="emit('validate-category')"
        >
          <el-option
            v-for="item in categories"
            :key="item.id"
            :value="item.id"
            :label="item.is_active ? item.name : `${item.name}（已作废）`"
          />
        </el-select>
        <div v-if="editErrors.category_id" class="field-error">
          {{ editErrors.category_id }}
        </div>
      </el-form-item>

      <el-form-item label="单价">
        <el-input
          v-model="editForm.base_price"
          placeholder="请输入单价，如 3.50"
          type="number"
          min="0.01"
          max="100"
          step="0.01"
          @blur="emit('validate-base-price')"
        />
        <div v-if="editErrors.base_price" class="field-error">
          {{ editErrors.base_price }}
        </div>
      </el-form-item>
      <el-form-item>
        <template #label>
          <span class="th-with-tip">
            单价波动
            <el-tooltip :content="volatilityTooltip" placement="top">
              <el-icon class="th-tip">
                <InfoFilled />
              </el-icon>
            </el-tooltip>
          </span>
        </template>
        <el-input
          v-model.number="editForm.volatility_percent"
          placeholder="请输入波动百分比，如 5"
          type="number"
          min="0"
          max="100"
          step="0.1"
          @blur="emit('validate-volatility')"
        >
          <template #suffix>%</template>
        </el-input>
        <div v-if="editErrors.volatility_percent" class="field-error">
          {{ editErrors.volatility_percent }}
        </div>
      </el-form-item>
      <el-form-item>
        <template #label>
          <span class="th-with-tip">
            采购数量范围
            <el-tooltip :content="quantityRuleTooltip" placement="top">
              <el-icon class="th-tip">
                <InfoFilled />
              </el-icon>
            </el-tooltip>
          </span>
        </template>
        <div class="inline">
          <el-input-number
            v-model="editForm.item_quantity_min"
            :min="0"
            :step="editQuantityStep"
            @blur="emit('validate-item-range')"
          />
          <span>至</span>
          <el-input-number
            v-model="editForm.item_quantity_max"
            :min="0"
            :step="editQuantityStep"
            @blur="emit('validate-item-range')"
          />
        </div>
        <div v-if="editErrors.item_quantity_range" class="field-error">
          {{ editErrors.item_quantity_range }}
        </div>
      </el-form-item>
      <el-form-item>
        <template #label>
          <span class="th-with-tip">
            单位
            <el-tooltip :content="unitTooltip" placement="top">
              <el-icon class="th-tip">
                <InfoFilled />
              </el-icon>
            </el-tooltip>
          </span>
        </template>
        <el-input
          v-model="editForm.unit"
          placeholder="如 斤 / 份 / 包"
          @blur="emit('unit-blur')"
        />
        <div v-if="editErrors.unit" class="field-error">
          {{ editErrors.unit }}
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:open', false)">取消</el-button>
      <el-button type="primary" @click="emit('save')">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.product-dialog :deep(.el-dialog__body) {
  padding-right: 24px;
}

.product-edit-form :deep(.el-form-item) {
  margin-bottom: 24px;
}

.product-dialog :deep(.el-input-number),
.product-dialog :deep(.el-input),
.product-dialog :deep(.el-select) {
  max-width: 100%;
}

.product-dialog :deep(.inline) {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  align-items: center;
}

.product-dialog :deep(.el-input-number) {
  width: 110px;
}

.field-error {
  margin-top: 6px;
  line-height: 1.4;
  font-size: 12px;
  color: #f56c6c;
}

.field-muted {
  margin-top: 6px;
  line-height: 1.4;
  font-size: 12px;
  color: var(--muted);
}

@media (max-width: 900px) {
  .product-dialog :deep(.el-dialog__body) {
    padding-right: 18px;
  }

  .product-dialog :deep(.inline) {
    flex-wrap: wrap;
  }

  .product-dialog :deep(.el-input-number) {
    width: 100%;
  }
}
</style>
