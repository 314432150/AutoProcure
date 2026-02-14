<script setup>
/** 页面职责：路由壳层，仅负责日期参数与返回导航 */
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import PlanDetailEditor from "@/components/plans/PlanDetailEditor.vue";

const route = useRoute();
const router = useRouter();

/** 当前计划日期（从路由参数读取） */
const planDate = computed(() => String(route.params.date || ""));

/** 返回采购计划列表页 */
const goBack = () => {
  router.push("/plans");
};
</script>

<template>
  <section class="page plan-detail-page">
    <el-page-header class="back-header" title="返回计划列表" @back="goBack" />

    <el-card class="card table-card">
      <PlanDetailEditor :plan-date="planDate" />
    </el-card>
  </section>
</template>

<style scoped>
.back-header {
  width: fit-content;
  margin: 2px 0 8px;
}

.back-header :deep(.el-page-header__left),
.back-header :deep(.el-page-header__title) {
  color: var(--accent);
  font-size: 14px;
  font-weight: 500;
}

.back-header:hover :deep(.el-page-header__left),
.back-header:hover :deep(.el-page-header__title) {
  color: var(--accent-deep);
}
</style>
