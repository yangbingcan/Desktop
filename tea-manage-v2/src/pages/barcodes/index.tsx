/** @file 条码生成打印 - JsBarcode + qrcode + 标签设计 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, Button, Input, Select, Table, Tag, message, Row, Col, InputNumber, Checkbox } from 'antd'
import { BarcodeOutlined, PrinterOutlined } from '@ant-design/icons'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { getProducts, type Product } from '../../services/productService'

export default function BarcodePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [keyword, setKeyword] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [barcodeType, setBarcodeType] = useState<'code128' | 'qrcode'>('code128')
  const [labelWidth, setLabelWidth] = useState(40)
  const [labelHeight, setLabelHeight] = useState(30)
  const [printCount, setPrintCount] = useState(1)
  const [includePrice, setIncludePrice] = useState(true)
  const [previewSrc, setPreviewSrc] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loadData = useCallback(async () => {
    try {
      const res = await getProducts({ page: 1, pageSize: 100, keyword })
      setProducts(res.list || [])
    } catch (e: any) {
      message.error(e?.toString() || '加载失败')
    }
  }, [keyword])

  useEffect(() => { loadData() }, [loadData])

  // 生成条码预览
  const generateBarcode = useCallback(async (product: Product) => {
    if (!canvasRef.current) return
    const codeValue = `${product.code}-${product.base_unit}`

    if (barcodeType === 'code128') {
      JsBarcode(canvasRef.current, codeValue, {
        format: 'CODE128', width: 2, height: 60,
        displayValue: true, fontSize: 12, margin: 10,
      })
      setPreviewSrc(canvasRef.current.toDataURL('image/png'))
    } else {
      const data = JSON.stringify({ code: product.code, name: product.name, origin: product.origin })
      const dataUrl = await QRCode.toDataURL(data, { width: 120, margin: 1 })
      setPreviewSrc(dataUrl)
    }
  }, [barcodeType])

  const handlePreview = (product: Product) => {
    generateBarcode(product)
  }

  const handlePrint = () => {
    if (selectedProducts.length === 0) {
      message.warning('请选择要打印的商品')
      return
    }
    const selected = products.filter(p => selectedProducts.includes(p.id))
    const printContent = generatePrintHtml(selected)
    const win = window.open('', '_blank', 'width=400,height=600')
    if (win) {
      win.document.write(printContent)
      win.document.close()
      win.print()
    }
  }

  const generatePrintHtml = (items: Product[]) => {
    const labels = items.map(p => {
        return `<div style="display:inline-block;width:${labelWidth}mm;height:${labelHeight}mm;border:1px solid #ddd;padding:2mm;text-align:center;vertical-align:top;margin:1mm;">
        <div style="font-size:8pt;font-weight:bold;margin-bottom:1mm;">${p.name}</div>
        <svg id="bc-${p.id}"></svg>
        ${includePrice ? `<div style="font-size:9pt;font-weight:bold;">¥${getProductPrice()}</div>` : ''}
        <div style="font-size:7pt;color:#666;">${p.origin || ''} ${p.year || ''}</div>
      </div>`
    }).join('')
    return `<html><head><title>条码打印</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"></script>
    </head><body style="margin:0;padding:5mm;">
      ${labels}
      <script>
        ${items.map(p => `JsBarcode("#bc-${p.id}", "${p.code}-${p.base_unit}", {format:"CODE128",width:1.5,height:30,fontSize:10,margin:2});`).join('\n')}
        setTimeout(function(){window.print();},500);
      </script>
    </body></html>`
  }

  const getProductPrice = () => '0.00'

  const rowSelection = {
    selectedRowKeys: selectedProducts,
    onChange: (keys: React.Key[]) => setSelectedProducts(keys as string[]),
  }

  return (
    <div className="p-4">
      <Row gutter={16}>
        <Col span={16}>
          <Card title={<><BarcodeOutlined /> 商品条码</>}
            extra={
              <Input.Search placeholder="搜索商品" value={keyword}
                onChange={e => setKeyword(e.target.value)} onSearch={loadData}
                style={{ width: 200 }} allowClear />
            }>
            <Table rowSelection={rowSelection} dataSource={products} rowKey="id" size="small"
              pagination={{ pageSize: 10, showSizeChanger: false }}
              columns={[
                { title: '编码', dataIndex: 'code', width: 140 },
                { title: '名称', dataIndex: 'name', width: 180 },
                { title: '类型', dataIndex: 'product_type', width: 70,
                  render: (v: string) => <Tag color={v === 'weight' ? 'green' : 'blue'}>{v === 'weight' ? '称重' : '计件'}</Tag> },
                { title: '操作', width: 80,
                  render: (_: any, r: Product) => <Button size="small" onClick={() => handlePreview(r)}>预览</Button> },
              ]}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card title="打印设置" size="small">
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>条码类型</label>
              <Select value={barcodeType} onChange={v => setBarcodeType(v)} style={{ width: '100%' }}
                options={[{ label: 'Code128 一维码', value: 'code128' }, { label: 'QR 二维码', value: 'qrcode' }]} />
            </div>
            <Row gutter={8}>
              <Col span={12}>
                <label style={{ display: 'block', marginBottom: 4 }}>标签宽度(mm)</label>
                <InputNumber value={labelWidth} onChange={v => setLabelWidth(v || 40)} min={20} max={100} style={{ width: '100%' }} />
              </Col>
              <Col span={12}>
                <label style={{ display: 'block', marginBottom: 4 }}>标签高度(mm)</label>
                <InputNumber value={labelHeight} onChange={v => setLabelHeight(v || 30)} min={15} max={80} style={{ width: '100%' }} />
              </Col>
            </Row>
            <div style={{ marginTop: 8 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>打印份数</label>
              <InputNumber value={printCount} onChange={v => setPrintCount(v || 1)} min={1} max={100} style={{ width: '100%' }} />
            </div>
            <div style={{ marginTop: 8 }}>
              <Checkbox checked={includePrice} onChange={e => setIncludePrice(e.target.checked)}>包含价格</Checkbox>
            </div>
            <Button type="primary" icon={<PrinterOutlined />} block style={{ marginTop: 12 }}
              onClick={handlePrint} disabled={selectedProducts.length === 0}>
              打印选中商品 ({selectedProducts.length})
            </Button>
          </Card>

          <Card title="预览" size="small" style={{ marginTop: 12 }}>
            <div style={{ textAlign: 'center', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {previewSrc ? <img src={previewSrc} alt="条码预览" style={{ maxWidth: '100%' }} /> :
                <span style={{ color: '#999' }}>选择商品后预览</span>}
            </div>
          </Card>
        </Col>
      </Row>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
