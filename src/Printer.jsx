import { useState, useEffect } from 'react'
import { Card, Col, Descriptions, Space, Flex, Upload, Button } from 'antd';
import { PrinterTwoTone, UploadOutlined, DeleteOutlined, PrinterOutlined } from '@ant-design/icons';
import pretty from 'pretty-time'


export function Printer(props) {
  
  const [file, set_file] = useState(null)
  const [moves, set_moves] = useState(null)
  const [info, set_info] = useState(null)
  const [thumbnail, set_thumbnail] = useState(null)
  
  console.log(props)
  const index = 1
  const printer_description_items = Object.entries(props.printer).map(([k, v], i) => ({ key: i, label: k, children: v }))
  
  useEffect(() => {
    if (file && file.status!='removed') {
      const reader = new FileReader();
      reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n');
        let moves = 0
        let info = {}
        let in_thumbnail = false
        let thumbnail = ''
        lines.forEach((line, index) => {
          line = line.trim()
          const comment_index = line.indexOf(';')
          const cmd = comment_index==-1 ? line : line.slice(0, line.indexOf(';')).trim()
          const comment = comment_index==-1 ? null : line.slice(comment_index + 1).trim()
          if (cmd.length) ++moves
          const colon_index = comment ? comment.indexOf(':') : -1
          if (colon_index!=-1) {
            info[comment.slice(0,colon_index).trim()] = comment.slice(colon_index+1).trim()
          }
          if (in_thumbnail) {
            if (comment?.startsWith('thumbnail end')) in_thumbnail = false
            else thumbnail += comment
          }
          if (comment?.startsWith('thumbnail begin')) in_thumbnail = true
        });
        set_moves(moves)
        set_info(info)
        set_thumbnail(thumbnail.length ? thumbnail : null)
        console.log('info', info)
        console.log('thumbnail', thumbnail)
      };
      console.log(file)
      reader.readAsText(file);
    } else {
      set_moves(null)
      set_info(null)
      set_thumbnail(null)
    }
  }, [file])

  async function handle_gcode(info) {
    console.log('info', info)
    set_file(info.file.status=='removed' ? null : info.file)
  }
  
  const description_title = (
    <Flex align='center' justify='center' gap='small'>
      Model:
      {thumbnail ? <img src={'data:image/png;base64,'+thumbnail} style={{verticalAlign:'middle'}}/> : null}
      <Button type="text" icon={<DeleteOutlined />} onClick={() => set_file(null)} />
    </Flex>
  )

  const print_description = (
    <Space size="small">
      <PrinterTwoTone />
      <span style={{ color: 'gray', fontWeight: 'normal' }}>
        {props.printer.ip}:{props.printer.port}
      </span>
    </Space>
  )

  return (
    <Col xs={24} sm={12} md={12} lg={8}>
      <Card>

        <Flex vertical align='center' gap='small'>
        {print_description}
          {file ? null : <Upload maxCount={1} onChange={info => handle_gcode(info)} beforeUpload={()=>false}>
            <Button icon={<UploadOutlined />}>GCode</Button>
          </Upload>}
          {file ? <Descriptions title={description_title} column={{ xs: 1, sm: 1, md: 2, lg:2}} size='small' style={{marginTop:'.5em'}}>
            {file?.name ? <Descriptions.Item label="File" span={2}>
              {file?.name}
            </Descriptions.Item> : null}
            {info?.['TARGET_MACHINE.NAME'] ? <Descriptions.Item label="Target" span={2}>
              {info?.['TARGET_MACHINE.NAME']}
            </Descriptions.Item> : null}
            {moves ? <Descriptions.Item label="Moves">
                {moves.toLocaleString()}
              </Descriptions.Item> : null}
            {info?.TIME ? <Descriptions.Item label="Time">
              {pretty([parseFloat(info?.TIME), 0])}
            </Descriptions.Item> : null}
            {info?.['Filament used'] ? <Descriptions.Item label="Filament">
              {Math.ceil(100*parseFloat(info['Filament used'])).toLocaleString()+'cm'}
            </Descriptions.Item> : null}
            {info?.MAXX && info?.MAXY && info?.MAXZ ? <Descriptions.Item label="Box">
              {Math.ceil(info?.MAXX).toLocaleString()+'x'+Math.ceil(info?.MAXY).toLocaleString()+'x'+Math.ceil(info?.MAXZ).toLocaleString()+"mm"}
            </Descriptions.Item> : null}
            {info?.LAYER_COUNT ? <Descriptions.Item label="Layers">
              {parseInt(info?.LAYER_COUNT).toLocaleString()}
            </Descriptions.Item> : null}
          </Descriptions> : null}

          {file ? <Button type="primary" icon={<PrinterOutlined />}>
            Print
          </Button> : null}
        </Flex>
      </Card>

    </Col>

  )
}