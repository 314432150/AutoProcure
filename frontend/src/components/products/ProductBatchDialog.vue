<script setup>
import { InfoFilled } from "@element-plus/icons-vue";

defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  batchForm: {
    type: Object,
    required: true,
  },
  categories: {
    type: Array,
    default: () => [],
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
  batchQuantityStep: {
    type: Number,
    default: 1,
  },
});

const emit = defineEmits(["update:open", "apply"]);
</script>

<template>
  <el-dialog
    :model-value="open"
    title="批量设置产品规则"
    width="480px"
    @update:model-value="(value) => emit('update:open', value)"
  >
    <el-form label-position="top">
      <el-form-item label="品类">
        <el-select v-model="batchForm.category_id" placeholder="请选择品类">
          <el-option
            v-for="item in categories"
            :key="item.id"
            :value="item.id"
            :label="item.is_active ? item.name : `${item.name}（已作废）`"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="更新字段">
        <el-checkbox v-model="batchForm.update_volatility"
          >单价波动</el-checkbox
        >
        <el-checkbox v-model="batchForm.update_item_quantity"
          >采购数量范围</el-checkbox
        >
        <el-checkbox v-model="batchForm.update_unit">单位</el-checkbox>
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
          v-model.number="batchForm.volatility_percent"
          type="number"
          min="0"
          max="100"
          step="0.1"
          :disabled="!batchForm.update_volatility"
        >
          <template #suffix>%</template>
        </el-input>
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
            v-model="batchForm.item_quantity_min"
            :min="0"
            :step="batchQuantityStep"
            :disabled="!batchForm.update_item_quantity"
          />
          <span>至</span>
          <el-input-number
            v-model="batchForm.item_quantity_max"
            :min="0"
            :step="batchQuantityStep"
            :disabled="!batchForm.update_item_quantity"
          />
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
          v-model="batchForm.unit"
          :disabled="!batchForm.update_unit"
          placeholder="如 斤 / 份 / 包"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:open', false)">取消</el-button>
      <el-button type="primary" @click="emit('apply')">应用</el-button>
    </template>
  </el-dialog>
</template>
