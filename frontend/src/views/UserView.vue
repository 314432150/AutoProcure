<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import client, { unwrap } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { useRoute } from "vue-router";
import { useTabsStore } from "../stores/tabs";

const auth = useAuthStore();
const route = useRoute();
const tabsStore = useTabsStore();
const loading = ref(false);
const saving = ref(false);
const profileSnapshot = ref({ full_name: "" });

const form = reactive({
  username: "",
  full_name: "",
  current_password: "",
  new_password: "",
  confirm_password: "",
});

/** 将用户资料回填到表单 */
const applyProfile = (profile) => {
  form.username = profile?.username || "";
  form.full_name = profile?.full_name || "";
  profileSnapshot.value = { full_name: form.full_name };
};

const hasPasswordInput = computed(() =>
  Boolean(form.current_password || form.new_password || form.confirm_password),
);
const isLengthValid = computed(() => form.new_password.length >= 8);
const hasLetter = computed(() => /[A-Za-z]/.test(form.new_password));
const hasNumber = computed(() => /[0-9]/.test(form.new_password));
const isComplexValid = computed(() => hasLetter.value && hasNumber.value);
const isConfirmValid = computed(
  () =>
    form.confirm_password === "" || form.new_password === form.confirm_password,
);
const isNewPasswordInvalid = computed(
  () =>
    form.new_password.length > 0 &&
    (!isLengthValid.value || !isComplexValid.value),
);
const isConfirmShown = computed(
  () => form.confirm_password.length > 0 && !isConfirmValid.value,
);

/** 获取当前用户信息 */
const fetchProfile = async () => {
  loading.value = true;
  try {
    const resp = await client.get("/api/auth/me");
    const data = unwrap(resp);
    applyProfile(data.user_info);
    auth.setSession(auth.token, data.user_info);
  } catch (error) {
    ElMessage.error("获取用户信息失败");
  } finally {
    loading.value = false;
  }
};

/** 保存用户资料并处理密码更新 */
const onSave = async () => {
  if (form.new_password || form.confirm_password || form.current_password) {
    if (
      !form.current_password ||
      !form.new_password ||
      !form.confirm_password
    ) {
      ElMessage.warning("请完整填写当前密码与新密码");
      return;
    }
    if (form.new_password !== form.confirm_password) {
      ElMessage.warning("两次输入的新密码不一致");
      return;
    }
    if (!isLengthValid.value) {
      ElMessage.warning("新密码至少 8 位");
      return;
    }
    if (!isComplexValid.value) {
      ElMessage.warning("新密码需包含字母和数字");
      return;
    }
  }

  saving.value = true;
  try {
    const profileResp = await client.put("/api/auth/profile", {
      full_name: form.full_name,
    });
    const profileData = unwrap(profileResp);
    auth.setSession(auth.token, profileData.user_info);

    if (form.new_password) {
      await client.put("/api/auth/password", {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      form.current_password = "";
      form.new_password = "";
      form.confirm_password = "";
    }

    ElMessage.success("保存成功");
  } finally {
    saving.value = false;
  }
};

onMounted(fetchProfile);

const profileDirty = computed(
  () => String(form.full_name || "") !== String(profileSnapshot.value.full_name || ""),
);

const passwordDirty = computed(() =>
  Boolean(form.current_password || form.new_password || form.confirm_password),
);

const pageDirty = computed(() => profileDirty.value || passwordDirty.value);

watch(
  () => pageDirty.value,
  (dirty) => {
    tabsStore.setDirty(route.fullPath, dirty);
  },
  { immediate: true },
);

const onWindowKeydown = (event) => {
  const key = String(event.key || "").toLowerCase();
  const isSaveKey = (event.ctrlKey || event.metaKey) && key === "s";
  if (!isSaveKey) return;
  event.preventDefault();
  if (!saving.value) {
    onSave();
  }
};

onMounted(() => {
  window.addEventListener("keydown", onWindowKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onWindowKeydown);
});
</script>

<template>
  <!-- 组件说明：用户信息页面，支持资料与密码修改 -->
  <section class="page">
    <div class="profile-stack">
      <el-form label-position="top" class="profile-form form-narrow">
        <el-card class="group-card">
            <template #header>账号信息</template>
          <el-form-item label="用户名">
            <el-input v-model="form.username" disabled />
          </el-form-item>
          <el-form-item label="姓名">
            <el-input v-model="form.full_name" placeholder="请输入姓名" />
          </el-form-item>
        </el-card>
        <el-card class="group-card">
            <template #header>修改密码</template>
          <el-form-item label="当前密码">
            <el-input
              v-model="form.current_password"
              type="password"
              show-password
            />
            <div
              v-if="hasPasswordInput && !form.current_password"
              class="field-tip warning"
            >
              请输入当前密码
            </div>
          </el-form-item>
          <el-form-item label="新密码">
            <el-input
              v-model="form.new_password"
              type="password"
              show-password
            />
            <div v-if="isNewPasswordInvalid" class="field-tip warning">
              至少 8 位，且包含字母与数字
            </div>
            <div v-else-if="form.new_password" class="field-tip ok">
              校验通过
            </div>
          </el-form-item>
          <el-form-item label="确认新密码">
            <el-input
              v-model="form.confirm_password"
              type="password"
              show-password
            />
            <div v-if="isConfirmShown" class="field-tip warning">
              两次输入一致
            </div>
            <div v-else-if="form.confirm_password" class="field-tip ok">
              校验通过
            </div>
          </el-form-item>
        </el-card>
      </el-form>
      <div class="profile-actions form-narrow">
        <div class="action-row">
          <el-button type="primary" :loading="saving" @click="onSave"
            >保存</el-button
          >
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* layout helpers are defined in style.css */

.profile-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.field-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted);
}

.field-tip.ok {
  color: #2f6f3e;
}

.field-tip.warning {
  color: #b8471b;
}

</style>
