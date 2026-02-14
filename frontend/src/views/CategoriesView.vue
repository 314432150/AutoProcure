<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Edit, InfoFilled } from '@element-plus/icons-vue'
import client, { unwrap } from '../api/client'
import { formatDateTime, formatRange } from '../utils/formatters'
import { useRoute } from 'vue-router'
import { useTabsStore } from '../stores/tabs'

const loading = ref(false)
const saving = ref(false)
const items = ref([])
const editOpen = ref(false)
const editMode = ref('create')
const deactivateOpen = ref(false)
const categoriesTableRef = ref(null)
const isBootstrapping = ref(true)
const isApplyingSort = ref(false)
const route = useRoute()
const tabsStore = useTabsStore()

const query = reactive({
  keyword: '',
  purchase_mode: '',
  is_active: '',
  sort_by: '',
  sort_order: '',
})

const editForm = reactive({
  id: '',
  name: '',
  purchase_mode: '',
  items_count_min: null,
  items_count_max: null,
  cycle_days: null,
  float_days: null,
})

const editErrors = reactive({
  name: '',
  purchase_mode: '',
  items_count_range: '',
  cycle_days: '',
  float_days: '',
})

const deactivateForm = reactive({
  id: '',
  name: '',
  product_count: 0,
  transfer_to_id: '',
})

const transferTargets = computed(() =>
  items.value.filter((item) => item.is_active && item.id !== deactivateForm.id)
)
const totalCount = computed(() => items.value.length)

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const checkCategoryNameConflict = async (name, currentId = '') => {
  const keyword = `^${escapeRegex(name)}$`
  const resp = await client.get('/api/categories', {
    params: {
      include_inactive: true,
      keyword,
    },
  })
  const data = unwrap(resp)
  const exact = (data.items || []).filter((item) => String(item.name || '').trim() === name)
  return exact.some((item) => item.id !== currentId)
}

/** 校验并构建选品数量范围 */
const buildRange = (min, max) => {
  if (min === null && max === null) {
    return null
  }
  if (min === null || max === null) {
    return undefined
  }
  if (Number(min) > Number(max)) {
    return undefined
  }
  return { min: Number(min), max: Number(max) }
}

const clearEditErrors = () => {
  editErrors.name = ''
  editErrors.purchase_mode = ''
  editErrors.items_count_range = ''
  editErrors.cycle_days = ''
  editErrors.float_days = ''
}

const validateName = () => {
  const value = String(editForm.name || '').trim()
  if (!value) {
    editErrors.name = '请输入品类名称'
    return false
  }
  editErrors.name = ''
  return true
}

const validatePurchaseMode = () => {
  if (!editForm.purchase_mode) {
    editErrors.purchase_mode = '请选择采购模式'
    return false
  }
  editErrors.purchase_mode = ''
  return true
}

const validateItemsCountRange = () => {
  const range = buildRange(editForm.items_count_min, editForm.items_count_max)
  if (range === undefined) {
    if (editForm.items_count_min === null || editForm.items_count_max === null) {
      editErrors.items_count_range = '选品数量范围请同时填写最小值与最大值，或全部留空'
    } else {
      editErrors.items_count_range = '选品数量范围最小值不能大于最大值'
    }
    return undefined
  }
  editErrors.items_count_range = ''
  return range
}

const validatePeriodicFields = () => {
  if (editForm.purchase_mode !== 'periodic') {
    editErrors.cycle_days = ''
    editErrors.float_days = ''
    return true
  }
  let ok = true
  if (editForm.cycle_days === null || Number(editForm.cycle_days) < 1) {
    editErrors.cycle_days = '周期天数需大于等于 1'
    ok = false
  } else {
    editErrors.cycle_days = ''
  }
  if (editForm.float_days === null || Number(editForm.float_days) < 0) {
    editErrors.float_days = '浮动天数需大于等于 0'
    ok = false
  } else {
    editErrors.float_days = ''
  }
  return ok
}

/** 拉取品类列表 */
const fetchCategories = async () => {
  loading.value = true
  try {
    const params = {
      include_inactive: true,
      keyword: query.keyword || undefined,
      purchase_mode: query.purchase_mode || undefined,
      is_active: query.is_active === '' ? undefined : query.is_active,
      sort_by: query.sort_by || undefined,
      sort_order: query.sort_order || undefined,
    }
    const resp = await client.get('/api/categories', { params })
    items.value = unwrap(resp).items
  } finally {
    loading.value = false
  }
}

let keywordTimer = null
/** 触发查询 */
const onSearch = () => {
  fetchCategories()
}

const toTableSortOrder = (sortOrder) => {
  if (sortOrder === 'asc') return 'ascending'
  if (sortOrder === 'desc') return 'descending'
  return null
}

const applyTableSortState = async () => {
  await nextTick()
  const table = categoriesTableRef.value
  if (!table) return
  const prop = query.sort_by || ''
  const order = toTableSortOrder(query.sort_order)
  if (!prop || !order) {
    table.clearSort()
    return
  }
  isApplyingSort.value = true
  table.sort(prop, order)
  await nextTick()
  isApplyingSort.value = false
}

/** 关键词输入触发防抖查询 */
const onKeywordInput = () => {
  if (keywordTimer) {
    clearTimeout(keywordTimer)
  }
  keywordTimer = setTimeout(() => {
    onSearch()
  }, 400)
}

/** 打开新增弹窗 */
const openCreate = () => {
  editMode.value = 'create'
  Object.assign(editForm, {
    id: '',
    name: '',
    purchase_mode: '',
    items_count_min: null,
    items_count_max: null,
    cycle_days: null,
    float_days: null,
  })
  clearEditErrors()
  editOpen.value = true
  editSnapshot.value = buildEditSnapshot()
}

/** 打开编辑弹窗并回填数据 */
const openEdit = (row) => {
  editMode.value = 'edit'
  editForm.id = row.id
  editForm.name = row.name
  editForm.purchase_mode = row.purchase_mode || ''
  editForm.items_count_min = row.items_count_range?.min ?? null
  editForm.items_count_max = row.items_count_range?.max ?? null
  editForm.cycle_days = row.cycle_days ?? null
  editForm.float_days = row.float_days ?? null
  clearEditErrors()
  editOpen.value = true
  editSnapshot.value = buildEditSnapshot()
}

/** 校验并保存品类（新增/修改共用） */
const onSave = async () => {
  if (saving.value) return
  const validName = validateName()
  const validPurchaseMode = validatePurchaseMode()
  const itemsCountRange = validateItemsCountRange()
  const periodicValid = validatePeriodicFields()
  if (!validName || !validPurchaseMode || itemsCountRange === undefined || !periodicValid) {
    ElMessage.warning('请先修正表单校验错误')
    return
  }
  const trimmedName = String(editForm.name).trim()
  const hasConflict = await checkCategoryNameConflict(
    trimmedName,
    editMode.value === 'edit' ? editForm.id : '',
  )
  if (hasConflict) {
    editErrors.name = '品类名称已存在，请修改后再保存'
    ElMessage.warning('品类名称已存在，请修改后再保存')
    return
  }
  editErrors.name = ''
  editForm.name = trimmedName
  const isPeriodic = editForm.purchase_mode === 'periodic'
  const payload = {
    name: trimmedName,
    purchase_mode: editForm.purchase_mode || null,
    items_count_range: itemsCountRange,
    cycle_days: isPeriodic ? (editForm.cycle_days ?? null) : null,
    float_days: isPeriodic ? (editForm.float_days ?? null) : null,
  }
  saving.value = true
  try {
    if (editMode.value === 'create') {
      await client.post('/api/categories', payload)
      ElMessage.success('品类已新增')
    } else {
      await client.put(`/api/categories/${editForm.id}`, payload)
      ElMessage.success('品类已更新')
    }
    editOpen.value = false
    editSnapshot.value = null
    fetchCategories()
  } finally {
    saving.value = false
  }
}

/** 打开作废弹窗并准备转移信息 */
const openDeactivate = async (row) => {
  deactivateForm.id = row.id
  deactivateForm.name = row.name
  deactivateForm.product_count = row.product_count || 0
  deactivateForm.transfer_to_id = ''
  if (deactivateForm.product_count === 0) {
    await onDeactivate()
    return
  }
  deactivateOpen.value = true
  deactivateSnapshot.value = buildDeactivateSnapshot()
}

/** 作废品类并可选转移产品 */
const onDeactivate = async () => {
  if (deactivateForm.product_count > 0 && !deactivateForm.transfer_to_id) {
    ElMessage.warning('该品类存在产品，请先选择转移目标')
    return
  }
  const payload = deactivateForm.transfer_to_id
    ? { transfer_to_id: deactivateForm.transfer_to_id }
    : null
  await client.post(`/api/categories/${deactivateForm.id}/deactivate`, payload)
  ElMessage.success('品类已作废')
  deactivateOpen.value = false
  deactivateSnapshot.value = null
  fetchCategories()
}

/** 启用品类 */
const onActivate = async (row) => {
  await client.post(`/api/categories/${row.id}/activate`)
  ElMessage.success('品类已启用')
  fetchCategories()
}

onMounted(() => {
  fetchCategories()
  applyTableSortState()
  isBootstrapping.value = false
})

const editSnapshot = ref(null)
const deactivateSnapshot = ref(null)

const buildEditSnapshot = () => ({
  name: editForm.name,
  purchase_mode: editForm.purchase_mode,
  items_count_min: editForm.items_count_min,
  items_count_max: editForm.items_count_max,
  cycle_days: editForm.cycle_days,
  float_days: editForm.float_days,
})

const buildDeactivateSnapshot = () => ({
  transfer_to_id: deactivateForm.transfer_to_id,
})

watch(
  () => query.purchase_mode,
  () => {
    if (isBootstrapping.value) return
    onSearch()
  },
)

watch(
  () => query.is_active,
  () => {
    if (isBootstrapping.value) return
    onSearch()
  },
)

watch(
  () => editForm.purchase_mode,
  (mode) => {
    validatePurchaseMode()
    if (mode !== 'periodic') {
      editForm.cycle_days = null
      editForm.float_days = null
    }
    validatePeriodicFields()
  },
)

const editDirty = computed(() => {
  if (!editOpen.value || !editSnapshot.value) return false
  return JSON.stringify(buildEditSnapshot()) !== JSON.stringify(editSnapshot.value)
})

const deactivateDirty = computed(() => {
  if (!deactivateOpen.value || !deactivateSnapshot.value) return false
  return JSON.stringify(buildDeactivateSnapshot()) !== JSON.stringify(deactivateSnapshot.value)
})

const pageDirty = computed(() => editDirty.value || deactivateDirty.value)

watch(
  () => pageDirty.value,
  (dirty) => {
    tabsStore.setDirty(route.fullPath, dirty)
  },
  { immediate: true },
)

const onWindowKeydown = (event) => {
  const key = String(event.key || '').toLowerCase()
  const isSaveKey = (event.ctrlKey || event.metaKey) && key === 's'
  if (!isSaveKey) return
  event.preventDefault()
  if (editOpen.value) {
    onSave()
    return
  }
  if (deactivateOpen.value) {
    onDeactivate()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onWindowKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown)
})

/** 表格排序变更处理 */
const onSortChange = (payload) => {
  if (isApplyingSort.value) {
    return
  }
  if (!payload?.prop || !payload?.order) {
    query.sort_by = ''
    query.sort_order = ''
    onSearch()
    return
  }
  query.sort_by = payload.prop
  query.sort_order = payload.order === 'ascending' ? 'asc' : 'desc'
  onSearch()
}

/** 记录查询条件到本地 */
</script>

<template>
  <!-- 组件说明：品类库页面，支持查询、编辑与作废/启用 -->
  <section class="page">
    <el-card class="card form-card">
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="搜索品类" clearable @input="onKeywordInput" />
        <el-select v-model="query.purchase_mode" placeholder="采购模式" clearable>
          <el-option label="每日" value="daily" />
          <el-option label="定期" value="periodic" />
        </el-select>
        <el-select v-model="query.is_active" placeholder="状态" clearable style="width: 120px">
          <el-option :value="true" label="启用" />
          <el-option :value="false" label="已作废" />
        </el-select>
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button type="primary" plain @click="openCreate">新增品类</el-button>
      </div>
    </el-card>

    <el-card class="card table-card">
      <div class="table-shell">
        <el-table
          ref="categoriesTableRef"
          :data="items"
          v-loading="loading"
          stripe
          height="100%"
          @row-dblclick="openEdit"
          @sort-change="onSortChange"
        >
          <el-table-column type="index" label="序号" width="70" fixed="left"/>
          <el-table-column prop="name" label="品类名称" min-width="160" sortable fixed="left">
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
          <el-table-column label="产品数" width="140" prop="product_count" sortable>
            <template #header>
              <span class="th-with-tip">
                产品数
                <el-tooltip content="该品类下当前产品数量" placement="top">
                  <el-icon class="th-tip">
                    <InfoFilled />
                  </el-icon>
                </el-tooltip>
              </span>
            </template>
            <template #default="scope">
              {{ scope.row.product_count }}
            </template>
          </el-table-column>
          <el-table-column label="采购模式" width="140" prop="purchase_mode" sortable>
            <template #header>
              <span class="th-with-tip">
                采购模式
                <el-tooltip content="每日：每个工作日触发；定期：按周期触发" placement="top">
                  <el-icon class="th-tip">
                    <InfoFilled />
                  </el-icon>
                </el-tooltip>
              </span>
            </template>
            <template #default="scope">
              <span v-if="scope.row.purchase_mode === 'daily'">每日</span>
              <span v-else-if="scope.row.purchase_mode === 'periodic'">定期</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="周期天数" width="110">
            <template #header>
              <span class="th-with-tip">
                周期天数
                <el-tooltip content="定期采购的固定周期天数" placement="top">
                  <el-icon class="th-tip">
                    <InfoFilled />
                  </el-icon>
                </el-tooltip>
              </span>
            </template>
            <template #default="scope">
              <span v-if="scope.row.cycle_days !== null && scope.row.cycle_days !== undefined">
                {{ scope.row.cycle_days }}
              </span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="浮动天数" width="110">
            <template #header>
              <span class="th-with-tip">
                浮动天数
                <el-tooltip content="周期触发的允许浮动天数" placement="top">
                  <el-icon class="th-tip">
                    <InfoFilled />
                  </el-icon>
                </el-tooltip>
              </span>
            </template>
            <template #default="scope">
              <span v-if="scope.row.float_days !== null && scope.row.float_days !== undefined">
                {{ scope.row.float_days }}
              </span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="选品数量范围" width="140">
            <template #header>
              <span class="th-with-tip">
                选品数量范围
                <el-tooltip content="每次触发从该品类中选品的数量范围" placement="top">
                  <el-icon class="th-tip">
                    <InfoFilled />
                  </el-icon>
                </el-tooltip>
              </span>
            </template>
            <template #default="scope">
              {{ formatRange(scope.row.items_count_range) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="120" prop="is_active" sortable>
            <template #default="scope">
              <el-tag v-if="scope.row.is_active" type="success">启用</el-tag>
              <el-tag v-else type="info">已作废</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="更新时间" width="180" prop="updated_at" sortable>
            <template #default="scope">
              {{ formatDateTime(scope.row.updated_at) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="scope">
              <el-button
                v-if="scope.row.is_active"
                type="danger"
                link
                @click="openDeactivate(scope.row)"
              >
                作废
              </el-button>
              <el-button v-else type="success" link @click="onActivate(scope.row)">启用</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="table-footer">共 {{ totalCount }} 条</div>
    </el-card>

    <el-dialog
      v-model="editOpen"
      :title="editMode === 'create' ? '新增品类' : '编辑品类'"
      width="520px"
    >
      <el-form label-position="left" label-width="120px">
        <el-form-item label="品类名称">
          <el-input v-model="editForm.name" @blur="validateName" />
          <div v-if="editErrors.name" class="field-error">{{ editErrors.name }}</div>
        </el-form-item>
        <el-form-item>
          <template #label>
            <span class="th-with-tip">
              采购模式
              <el-tooltip content="每日：每个工作日触发；定期：按周期触发" placement="top">
                <el-icon class="th-tip">
                  <InfoFilled />
                </el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-select v-model="editForm.purchase_mode" placeholder="">
            <el-option label="每日" value="daily" />
            <el-option label="定期" value="periodic" />
          </el-select>
          <div v-if="editErrors.purchase_mode" class="field-error">{{ editErrors.purchase_mode }}</div>
        </el-form-item>
        <el-form-item v-if="editForm.purchase_mode === 'periodic'" label="周期天数">
          <template #label>
            <span class="th-with-tip">
              周期天数
              <el-tooltip content="定期采购的固定周期天数" placement="top">
                <el-icon class="th-tip">
                  <InfoFilled />
                </el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input-number v-model="editForm.cycle_days" :min="1" @blur="validatePeriodicFields" />
          <div v-if="editErrors.cycle_days" class="field-error">{{ editErrors.cycle_days }}</div>
        </el-form-item>
        <el-form-item v-if="editForm.purchase_mode === 'periodic'" label="浮动天数">
          <template #label>
            <span class="th-with-tip">
              浮动天数
              <el-tooltip content="周期触发的允许浮动天数" placement="top">
                <el-icon class="th-tip">
                  <InfoFilled />
                </el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input-number v-model="editForm.float_days" :min="0" @blur="validatePeriodicFields" />
          <div v-if="editErrors.float_days" class="field-error">{{ editErrors.float_days }}</div>
        </el-form-item>
        <el-form-item label="选品数量范围">
          <template #label>
            <span class="th-with-tip">
              选品数量范围
              <el-tooltip content="每次触发从该品类中选品的数量范围" placement="top">
                <el-icon class="th-tip">
                  <InfoFilled />
                </el-icon>
              </el-tooltip>
            </span>
          </template>
          <div class="inline">
            <el-input-number v-model="editForm.items_count_min" :min="1" @blur="validateItemsCountRange" />
            <span>至</span>
            <el-input-number v-model="editForm.items_count_max" :min="1" @blur="validateItemsCountRange" />
          </div>
          <div v-if="editErrors.items_count_range" class="field-error">{{ editErrors.items_count_range }}</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editOpen = false">取消</el-button>
        <el-button type="primary" @click="onSave">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="deactivateOpen" title="作废品类" width="480px">
      <div class="deactivate-body">
        <p>将品类“{{ deactivateForm.name }}”设置为作废状态。</p>
        <p v-if="deactivateForm.product_count > 0" class="warning">
          当前品类下有 {{ deactivateForm.product_count }} 个产品，请先选择转移目标品类。
        </p>
        <el-form label-position="top">
          <el-form-item label="转移至">
            <el-select v-model="deactivateForm.transfer_to_id" placeholder="选择目标品类" clearable>
              <el-option
                v-for="item in transferTargets"
                :key="item.id"
                :value="item.id"
                :label="item.name"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="deactivateOpen = false">取消</el-button>
        <el-button type="danger" @click="onDeactivate">确认作废</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.deactivate-body {
  display: grid;
  gap: 8px;
}

.warning {
  margin: 0;
  color: var(--accent);
}
.table-footer {
  display: flex;
  justify-content: flex-end;
  color: #666;
  font-size: 12px;
  margin-top: 8px;
}

.field-error {
  margin-top: 6px;
  line-height: 1.4;
  font-size: 12px;
  color: #f56c6c;
}

</style>
