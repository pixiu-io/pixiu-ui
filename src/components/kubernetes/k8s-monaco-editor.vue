<template>
  <div
    ref="containerEl"
    class="k8s-monaco-editor"
    :class="{ 'k8s-monaco-editor--fill': fillHeight }"
    :style="
      fillHeight ? { height: '100%', width: '100%', minHeight: 0 } : { height: `${height}px`, width: '100%' }
    "
  />
</template>

<script setup lang="ts">
  import * as monaco from 'monaco-editor'
  import { ElMessage } from 'element-plus'
  import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

  const props = withDefaults(
    defineProps<{
      modelValue: string
      readOnly?: boolean
      height?: number
      /** 父级为有高度的 flex/grid 区域时铺满高度（如编辑器全屏） */
      fillHeight?: boolean
      /** 编辑器自动换行 */
      wordWrap?: boolean
      /** 正文字号 px */
      fontSize?: number
      language?: string
    }>(),
    { readOnly: true, height: 480, fillHeight: false, wordWrap: false, fontSize: 13, language: 'yaml' }
  )

  const emit = defineEmits<{ 'update:modelValue': [string] }>()

  const containerEl = ref<HTMLElement | null>(null)
  const editorRef = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  let contentListener: monaco.IDisposable | null = null

  defineExpose({
    getValue: () => editorRef.value?.getValue() ?? ''
  })

  onMounted(() => {
    if (!containerEl.value) return
    const ed = monaco.editor.create(containerEl.value, {
      theme: 'vs-dark',
      language: props.language,
      value: props.modelValue,
      readOnly: props.readOnly,
      automaticLayout: true,
      minimap: { enabled: true, scale: 0.85 },
      scrollBeyondLastLine: false,
      fontSize: props.fontSize,
      lineNumbers: 'on',
      lineNumbersMinChars: 3,
      folding: false,
      stickyScroll: { enabled: false },
      renderLineHighlight: 'gutter',
      glyphMargin: true,
      wordWrap: props.wordWrap ? 'on' : 'off',
      tabSize: 2,
      guides: { indentation: true, bracketPairs: false },
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      padding: { top: 8, bottom: 8 },
      colorDecorators: true,
      accessibilitySupport: 'auto'
    })
    editorRef.value = ed
    contentListener = ed.onDidChangeModelContent(() => {
      emit('update:modelValue', ed.getValue())
    })
    ed.onDidAttemptReadOnlyEdit(() => {
      ElMessage.warning('只读模式无法进行修改，请点击编辑模式')
    })
  })

  watch(
    () => props.readOnly,
    (v) => {
      editorRef.value?.updateOptions({ readOnly: v })
    }
  )

  watch(
    () => props.fontSize,
    (n) => {
      editorRef.value?.updateOptions({ fontSize: n })
    }
  )

  watch(
    () => props.wordWrap,
    (wrap) => {
      editorRef.value?.updateOptions({ wordWrap: wrap ? 'on' : 'off' })
    }
  )

  watch(
    () => props.fillHeight,
    () => {
      nextTick(() => editorRef.value?.layout())
    }
  )

  watch(
    () => props.modelValue,
    (v) => {
      const ed = editorRef.value
      if (!ed) return
      if (v !== ed.getValue()) ed.setValue(props.modelValue)
    }
  )

  onBeforeUnmount(() => {
    contentListener?.dispose()
    contentListener = null
    editorRef.value?.dispose()
    editorRef.value = null
  })
</script>

<style scoped lang="scss">
  .k8s-monaco-editor {
    overflow: hidden;
    border: 1px solid var(--el-border-color-darker);
    border-radius: 4px;
  }

  .k8s-monaco-editor--fill {
    flex: 1;
    border-radius: 0;
    border-top: none;
  }
</style>
