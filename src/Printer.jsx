import { useState, useEffect, useRef } from 'react'
import { Card, Col, Descriptions, Space, Flex, Upload, Button, Progress, Popconfirm, Tooltip, Spin, Alert } from 'antd';
import { PrinterTwoTone, UploadOutlined, DeleteOutlined, PrinterOutlined, StopOutlined, LinkOutlined, WarningOutlined, CloseOutlined, HomeOutlined } from '@ant-design/icons';
import pretty from 'pretty-time'

const RUNNING_COMMAND = {} // {url: {cmd, resolve_ok, reject_ok}}

export function Printer(props) {
  
  const [file, set_file] = useState(null)
  const [cmds, set_cmds] = useState(null)
  const [info, set_info] = useState(null)
  const [thumbnail, set_thumbnail] = useState(null)
  const [progress, set_progress] = useState(null)
  const [request_print, set_request_print] = useState(false)
  const [request_cancel, set_request_cancel] = useState(false)
  const [cancelled, set_cancelled] = useState(false)
  const [print_exception, set_print_exception] = useState(false)
  const [nozzle_temp, set_nozzle_temp] = useState(null)
  const [nozzle_temp_setpoint, set_nozzle_temp_setpoint] = useState(null)
  const [bed_temp, set_bed_temp] = useState(null)
  const [bed_temp_setpoint, set_bed_temp_setpoint] = useState(null)
  const [print_started_at, set_print_started_at] = useState(null)
  const [ws, set_ws] = useState(null)
  
  const index = 1

  const request_cancel_ref = useRef(request_cancel);
  useEffect(() => {
    request_cancel_ref.current = request_cancel;
  }, [request_cancel]);

  const ws_ref = useRef(ws);
  useEffect(() => {
    ws_ref.current = ws;
  }, [ws]);

  const url = 'ws://'+props.printer.ip+':'+props.printer.port.toString()

  async function connect() {
    set_ws(null)
    await wait(1000)
    console.log('connecting', url)
    const ws = new WebSocket(url);
    ws.onopen = async () => {
      console.log('connected')
      await wait(2500);
      set_ws(ws)
    }
    ws.onclose = () => {
      set_ws(undefined)
      set_nozzle_temp(null)
      set_nozzle_temp_setpoint(null)
      set_bed_temp(null)
      set_bed_temp_setpoint(null)
    }
    ws.onmessage = (event) => {
      console.log('<=', event.data)
      const state = parse_status(event.data)
      if (state.T) set_nozzle_temp(state.T);
      if (state.Ts) set_nozzle_temp_setpoint(state.Ts);
      if (state.B) set_bed_temp(state.B);
      if (state.Bs) set_bed_temp_setpoint(state.Bs);
      if (RUNNING_COMMAND[url].resolve_ok && state.ok) {
        RUNNING_COMMAND[url].resolve_ok();
        RUNNING_COMMAND[url] = {cmd:null, resolve_ok:null, reject_ok:null}
      }
    };
    ws.onerror = (error) => {
      RUNNING_COMMAND[url]?.reject_ok(error);
      RUNNING_COMMAND[url] = {cmd:null, resolve_ok:null, reject_ok:null}
    };
  }

  useEffect(() => {
    connect()
  }, []);

  function send_cmd(cmd) {
    return new Promise((resolve_ok, reject_ok) => {
      RUNNING_COMMAND[url] = {cmd, resolve_ok, reject_ok}
      console.log('=>', cmd)
      ws_ref.current.send(cmd);
    });
  }

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
        let cmds = []
        lines.forEach((line, index) => {
          line = line.trim()
          const comment_index = line.indexOf(';')
          const cmd = comment_index==-1 ? line : line.slice(0, line.indexOf(';')).trim()
          if (cmd?.length) cmds.push(cmd)
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
        set_cmds(cmds)
        set_info(info)
        set_thumbnail(thumbnail.length ? thumbnail : null)
        console.log('info', info)
        console.log('thumbnail', thumbnail)
      };
      console.log(file)
      reader.readAsText(file);
    } else {
      set_info(null)
      set_thumbnail(null)
      set_progress(null)
      set_cmds(null)
      set_request_print(false)
      set_request_cancel(false)
      set_cancelled(false)
      set_print_exception(false)
      set_print_started_at(null)
    }
  }, [file])

  async function inquire() {
    while (!ws_ref.current) await wait(1000)
    await send_cmd('M105')
  }

  useEffect(() => {
    inquire()
  }, [])

  async function handle_gcode(info) {
    console.log('info', info)
    set_file(info.file.status=='removed' ? null : info.file)
  }

  async function print(cmds) {
    set_request_print(true)
    set_print_exception(false)
    const url = 'ws://'+props.printer.ip+':'+props.printer.port.toString()

    while (!ws_ref.current) await wait(1000)

    set_request_print(false)
    set_progress(0)
    set_print_started_at(Date.now())

    console.log('cmds', cmds)

    try {
      for (let i=0; i<cmds.length; ++i) {
        if (request_cancel_ref.current) {
          console.log('cancelling')
          await(2500)
          set_print_exception(true)
          for (let j in CANCEL_CMDS) {
            const cancel_cmd = CANCEL_CMDS[j]
            await send_cmd(cancel_cmd)
          }
          set_cancelled(true)
          return
        }
        const cmd = cmds[i]
        set_progress(i)
        //if (cmd=='M155 S0') continue // always report temp
        await send_cmd(cmd)
      }
      set_progress(cmds.length)
    } catch(error) {
      alert(error)
      console.log('failed to send', error)
      set_print_exception(true)
    } finally {
      set_request_print(false)
      set_request_cancel(false)
    }

  }

  const description_title = (
    <Flex align='center' justify='center' gap='small'>
      {thumbnail ? <img src={'data:image/png;base64,'+thumbnail} style={{verticalAlign:'middle', maxHeight:'32pt'}}/> : null}
      Model
      <Tooltip title="Remove Model" >
        <Button type="text" icon={<DeleteOutlined />} onClick={() => set_file(null)} />
      </Tooltip>
    </Flex>
  )

  let connection_status = null;
  if (ws===undefined) connection_status = null
  else if (!ws) connection_status = <Spin size='small' style={{verticalAlign:'text-top', paddingLeft:'2pt'}}/>
  else connection_status = <a href={'http://'+props.printer.ip} target='_blank'><LinkOutlined /></a>

  const print_description = (
    <Space size="small">
      <PrinterTwoTone />
      <span style={{ color: 'gray', fontWeight: 'normal' }}>
        @ ws://{props.printer.ip}:{props.printer.port} {connection_status}
      </span>
    </Space>
  )

  const progress_percent = progress== null || !cmds?.length ? null : Math.round(100*progress/cmds?.length)

  function close_action() {
    ws?.close()
    props.close()
  }

  const actions = [];

  async function home() {
    await send_cmd('G28')
  }

  if (ws) {
    actions.push(
      <Tooltip onActionClick={()=>home()} title="Home"><HomeOutlined /></Tooltip>
    )
  }

  if (file && ws && (progress==null || print_exception || progress_percent==100)) {
    actions.push(
      <ActionWithText key='print' style={{color:'rgb(22, 119, 255)'}} onActionClick={()=>print(cmds)} icon={request_print ? <Spin/> : <PrinterOutlined />}>
        Print {print_exception || progress_percent==100 ? 'Again' : null}
      </ActionWithText>
    )
  }

  if (!(progress==null || progress_percent==100) && !cancelled) {
    actions.push(
      <Popconfirm key='cancel' description="Are you sure you want to cancel?" onConfirm={()=>set_request_cancel(true)}>
        <ActionWithText style={{color:'#ff7875'}} icon={request_print ? <Spin/> : <StopOutlined />}>
          Cancel
        </ActionWithText>
      </Popconfirm>
    )
  }

  if (ws===undefined) {
    actions.push(
      <ActionWithText key='reconnect' style={{color:'#ff7875'}} onActionClick={()=>connect()} icon={request_print ? <Spin/> : <WarningOutlined />}>
        Reconnect
      </ActionWithText>
    )
  }

  const hidden_upload_ref = useRef(null);
  const hidden_upload = (
    <input type='file' ref={hidden_upload_ref} onChange={e => set_file(e.target.files[0]) || (e.target.value='')} beforeUpload={()=>false} style={{display:'none'}}/>
  )

  if (!file) {
    
    actions.push(
      <ActionWithText key='upload' onActionClick={()=>console.log('hidden_upload_ref.current', hidden_upload, hidden_upload_ref.current) || hidden_upload_ref.current.click()} icon={request_print ? <Spin/> : <UploadOutlined />}>
        Upload
      </ActionWithText>
    )
  }

  actions.push(
    <Tooltip title="Disconnect" key='close' onActionClick={()=>close_action()}>
      <CloseOutlined />
    </Tooltip>
  )


  return (
    <Col xs={24} sm={12} md={12} lg={8}>
      <Card actions={actionClicks(actions)}>

        <Flex vertical align='center' gap='small'>

          {print_description}

          {ws===undefined ? <Alert message="Printer Disconnected" type="error" showIcon /> : null}
  
          <Descriptions title={file ? description_title : null} column={{ xs: 1, sm: 1, md: 2, lg:2}} size='small' style={{marginTop:'.5em'}}>
            {file?.name ? <Descriptions.Item label="File" span={2}>
              {file?.name}
            </Descriptions.Item> : null}
            {info?.['TARGET_MACHINE.NAME'] ? <Descriptions.Item label="Target" span={2}>
              {info?.['TARGET_MACHINE.NAME']}
            </Descriptions.Item> : null}
            {info?.['Filament used'] ? <Descriptions.Item label="Filament">
              {(Math.ceil(100*parseFloat(info['Filament used']))/100).toLocaleString()+'m / '+ metersToGrams(parseFloat(info['Filament used']))+'g'}
            </Descriptions.Item> : null}
            {info?.MAXX && info?.MAXY && info?.MAXZ ? <Descriptions.Item label="Box">
              {Math.ceil(info?.MAXX).toLocaleString()+'×'+Math.ceil(info?.MAXY).toLocaleString()+'×'+Math.ceil(info?.MAXZ).toLocaleString()}mm³
            </Descriptions.Item> : null}
            {info?.LAYER_COUNT ? <Descriptions.Item label="Layers">
              {parseInt(info?.LAYER_COUNT).toLocaleString()}
            </Descriptions.Item> : null}
            {cmds?.length ? <Descriptions.Item label="Steps">
              {progress ? progress.toLocaleString()+' of ' : null}
              {cmds?.length.toLocaleString()}
            </Descriptions.Item> : null}
            {info?.TIME ? <Descriptions.Item label="Time">
              {print_started_at ? pretty([parseFloat(info?.TIME), 0]) +' ('+ pretty([parseFloat(info?.TIME) - (Date.now()-print_started_at)/1000, 0]) +' left)' : pretty([parseFloat(info?.TIME), 0])}
            </Descriptions.Item> : null}
            {nozzle_temp==null ? null : <Descriptions.Item label="Nozzle">
              <Tooltip title="Actual">{(Math.round((nozzle_temp||0)*10)/10).toLocaleString()}&deg;</Tooltip>
               &nbsp;/&nbsp;
               <Tooltip title="Target">{(Math.round((nozzle_temp_setpoint||0)*10)/10).toLocaleString()}&deg;</Tooltip> C
            </Descriptions.Item>}
            {bed_temp==null ? null : <Descriptions.Item label="Bed">
              <Tooltip title="Actual">{(Math.round((bed_temp||0)*10)/10).toLocaleString()}&deg;</Tooltip>
              &nbsp;/&nbsp;
              <Tooltip title="Target">{(Math.round((bed_temp_setpoint||0)*10)/10).toLocaleString()}&deg;</Tooltip> C
            </Descriptions.Item>}
          </Descriptions>

          {progress==null ? null : <Progress percent={progress_percent} status={print_exception ? 'exception' : null} />}

          {hidden_upload}

        </Flex>
      </Card>

    </Col>

  )
}

function metersToGrams(length) {
  // Constants
  const pi = Math.PI;
  const diameter = 0.00175; // Diameter in meters (1.75 mm)
  const density = 1250 * 1000; // Density in g/m³ (example for PLA)
  
  // Calculate the cross-sectional area of the filament
  const radius = diameter / 2;
  const crossSectionalArea = pi * radius * radius;

  // Calculate the volume of the filament
  const volume = length * crossSectionalArea;

  // Calculate the weight of the filament
  const weight = volume * density;

  return Math.ceil(weight);
}


const CANCEL_CMDS = [
  'M190 S0', // Turn off heat bed, don't wait.
  'M104 S0', // Turn off nozzle, don't wait
  'M107', // Turn off part fan
  'M84 S1', // Turn off stepper motors.    
]

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parse_status(str) {
  // like: ok N0 P15 B15 T:25.2 /0.0 B:23.1 /0.0 T0:25.2 /0.0 @:0 B@:0
  const pairs = str.split(' ')
  const result = {};
  let last_key = null
  pairs.forEach(pair => {
    try {
      const [key, value] = pair.split(':')
      result[key] = parseFloat(value)
      if (last_key && key.startsWith('/')) result[key+'s'] = parseFloat(key.slice(1))
      last_key = key
    } catch (error) {
      console.log('could not parse status pair', pair)
    }
  });
  result.ok = str.startsWith('ok')
  return result;
}


function actionClicks(actions) {
  const action_style = { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, }
  return actions.map(action => (
    <span style={action_style} onClick={(e)=>action?.props?.onActionClick(e)}>{action}</span>
  ))
}

function ActionWithText(props) {
  return <Space {...props} size={4} className='anticon'>{props.icon}{props.children}</Space>
}