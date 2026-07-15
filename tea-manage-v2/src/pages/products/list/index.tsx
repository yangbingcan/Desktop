/** @file 商品档案列表页 - 完整 CRUD 交互 */
import { useState, useEffect, useCallback } from 'react'
import { Table, Button, Input, Space, Card, Tag, message, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { getProducts, deleteProduct, type Product } from '../../../services/productService'
import ProductForm from './ProductForm'

export default function ProductListPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getProducts({ page, pageSize: 20, keyword })
      setProducts(res.list || [])
      setTotal(res.total || 0)
    } catch (e: any) {
      message.error(e?.toString() || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [page, keyword])

  useEffect(() => { loadData() }, [loadData])

  const handleAdd = () => {
    setEditId(null)
    setFormOpen(true)
  }

  const handleEdit = (record: Product) => {
    setEditId(record.id)
    setFormOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct(id)
      message.success('删除成功')
      loadData()
    } catch (e: any) {
      message.error(e?.toString() || '删除失败')
    }
  }

  return (
    <div className="p-4">
      <Card title="商品档案" extra={
        <Space>
          <Input.Search placeholder="搜索商品名称/编码" value={keyword}
            onChange={e => setKeyword(e.target.value)} onSearch={loadData}
            style={{ width: 250 }} allowClear />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增商品</Button>
        </Space>
      }>
        <Table loading={loading} dataSource={products} rowKey="id"
          pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: (t) => `共 ${t} 条` }}
          columns={[
            { title: '商品编码', dataIndex: 'code', width: 150 },
            { title: '商品名称', dataIndex: 'name', width: 200 },
            { title: '分类', dataIndex: 'category_name', width: 120 },
            { title: '类型', dataIndex: 'product_type', width: 80,
              render: (v: string) => <Tag color={v === 'weight' ? 'green' : 'blue'}>{v === 'weight' ? '称重' : '计件'}</Tag> },
            { title: '产地', dataIndex: 'origin', width: 100 },
            { title: '库存', width: 120,
              render: (_: any, r: Product) => r.product_type === 'weight' ? `${r.stock_grams}g` : `${r.stock_units}个` },
            { title: '状态', dataIndex: 'is_active', width: 80,
              render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? '启用' : '停用'}</Tag> },
            { title: '操作', width: 150,
              render: (_: any, r: Product) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
                  <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              ) },
          ]}
        />
      </Card>

      <ProductForm
        open={formOpen}
        productId={editId}
        onClose={() => setFormOpen(false)}
        onSuccess={loadData}
      />
    </div>
  )
}
