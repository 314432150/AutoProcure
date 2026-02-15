<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import client, { unwrap } from '../api/client'
import YearMonthSelect from '../components/YearMonthSelect.vue'
import { useViewportBreakpoint } from '../composables/useViewportBreakpoint'

const loading = ref(false)
const workdays = ref([])
const query = reactive({
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
})
const isCompact = useViewportBreakpoint(900)

/** 获取指定年月的工作日列表 */
const fetchWorkdays = async () => {
  loading.value = true
  try {
    const resp = await client.get('/api/workdays', { params: query })
    const data = unwrap(resp)
    workdays.value = data.workdays || []
  } catch (error) {
    ElMessage.error('获取工作日失败')
  } finally {
    loading.value = false
  }
}

/** 格式化日期为 YYYY-MM-DD */
const formatDay = (year, month, day) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

const calendarWeeks = computed(() => {
  const year = query.year
  const month = query.month
  const today = new Date()
  const todayText = formatDay(today.getFullYear(), today.getMonth() + 1, today.getDate())
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  /** 计算日历首行的空白偏移 */
  const startOffset = (firstDay.getDay() + 6) % 7
  const totalDays = lastDay.getDate()
  const totalCells = Math.ceil((startOffset + totalDays) / 7) * 7
  const workdaySet = new Set(workdays.value)
  const cells = Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - startOffset + 1
    if (dayNumber < 1 || dayNumber > totalDays) {
      return null
    }
    const date = formatDay(year, month, dayNumber)
    return {
      day: dayNumber,
      date,
      isWorkday: workdaySet.has(date),
      isToday: date === todayText,
    }
  })
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }
  return weeks
})

onMounted(() => {
  fetchWorkdays()
})

watch(
  () => [query.year, query.month],
  () => {
    fetchWorkdays()
  },
)
</script>

<template>
  <!-- 组件说明：工作日查询页面，展示月度工作日日历 -->
  <section class="page">
    <el-card class="card form-card">
      <div class="toolbar">
        <YearMonthSelect v-model:year="query.year" v-model:month="query.month" />
      </div>
    </el-card>

    <el-card class="card table-card">
      <div class="workdays-head">
        <div>
          <div class="workdays-title">工作日清单</div>
          <div class="workdays-sub">共 {{ workdays.length }} 天</div>
        </div>
      </div>
      <div class="table-shell workdays-body" :class="{ 'workdays-body--compact': isCompact }">
        <div v-if="workdays.length" class="calendar">
          <div class="calendar-head">
            <div v-for="label in weekdayLabels" :key="label" class="calendar-cell head">周{{ label }}</div>
          </div>
          <div v-for="(week, index) in calendarWeeks" :key="index" class="calendar-row">
            <div
              v-for="(cell, cellIndex) in week"
              :key="cellIndex"
              class="calendar-cell"
              :class="{
                empty: !cell,
                workday: cell?.isWorkday,
              }"
            >
              <el-tooltip v-if="cell" :content="cell.date" placement="top">
                <div class="calendar-content">
                  <span v-if="cell.isToday" class="calendar-today">今</span>
                  <span v-if="cell.isWorkday" class="calendar-mark">班</span>
                  <span class="calendar-day">{{ cell.day }}</span>
                </div>
              </el-tooltip>
            </div>
          </div>
        </div>
        <el-empty v-if="!loading && workdays.length === 0" description="暂无数据" />
      </div>
    </el-card>
  </section>
</template>

<style scoped>
.workdays-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.workdays-title {
  font-weight: 600;
}

.workdays-sub {
  color: var(--muted);
  font-size: 12px;
  margin-top: 4px;
}

/* calendar content uses shared scrollable table shell */
.workdays-body {
  overflow: auto;
  gap: 16px;
}

.calendar {
  display: grid;
  gap: 8px;
}

.calendar-head,
.calendar-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.calendar-cell {
  height: 56px;
  border-radius: 12px;
  border: 1px solid rgba(107, 98, 86, 0.12);
  background: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink);
  font-weight: 600;
}

.calendar-content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.calendar-cell.head {
  height: 36px;
  background: rgba(255, 255, 255, 0.45);
  font-weight: 500;
  color: var(--muted);
}

.calendar-cell.empty {
  background: transparent;
  border: 1px dashed rgba(107, 98, 86, 0.08);
}

.calendar-cell:not(.workday):not(.empty) {
  background: transparent;
  border-color: rgba(107, 98, 86, 0.08);
  color: rgba(107, 98, 86, 0.7);
}

.calendar-cell.workday {
  background: rgba(255, 198, 198, 0.35);
  border-color: rgba(196, 0, 0, 0.18);
}

.calendar-day {
  font-size: 15px;
}

.calendar-mark {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 11px;
  color: var(--muted);
  padding: 2px 6px;
  border-radius: 999px;
  background: transparent;
  line-height: 1;
}

.calendar-today {
  position: absolute;
  bottom: 6px;
  left: 6px;
  font-size: 11px;
  color: #7a5a18;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(255, 231, 168, 0.9);
  border: 1px solid rgba(201, 164, 74, 0.35);
  line-height: 1;
}

.calendar-cell.workday .calendar-mark {
  color: #8f0000;
  background: rgba(255, 224, 224, 0.85);
}

@media (max-width: 900px) {
  .workdays-body--compact .calendar-head,
  .workdays-body--compact .calendar-row {
    gap: 6px;
  }

  .workdays-body--compact .calendar-cell {
    height: 48px;
    border-radius: 10px;
  }

  .workdays-body--compact .calendar-cell.head {
    height: 34px;
    font-size: 12px;
  }

  .workdays-body--compact .calendar-day {
    font-size: 14px;
  }

  .workdays-body--compact .calendar-mark {
    top: 4px;
    right: 4px;
    padding: 1px 4px;
  }

  .workdays-body--compact .calendar-today {
    bottom: 4px;
    left: 4px;
    padding: 1px 4px;
  }
}
</style>
