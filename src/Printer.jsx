import { useState, useEffect, useRef } from 'react'
import { Card, Col, Descriptions, Space, Flex, Progress, Popconfirm, Tooltip, Spin, Alert, Collapse, Input } from 'antd';
import { 
  PrinterTwoTone, UploadOutlined, PrinterOutlined, StopOutlined, LinkOutlined, 
  WarningOutlined, CloseOutlined, HomeOutlined, LoadingOutlined, ClearOutlined, 
  PlayCircleOutlined, PauseCircleOutlined, ArrowRightOutlined, CheckOutlined, 
  CodeOutlined, SendOutlined
} from '@ant-design/icons';
import pretty from 'pretty-time'

import {actionClicks, ActionWithText } from './AntdActionUtils'
import {wait} from './util'

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
  const [ws, set_ws] = useState(props.printer.ws)
  const [log, set_log] = useState([])
  const [pause, set_pause] = useState(false)
  const [manual_cmd_entry, set_manual_cmd_entry] = useState('')
  const [pic, set_pic] = useState('')
  const [running_command, set_running_command] = useState(null) // {url: {cmd, resolve_ok, reject_ok}}
  
  const index = 1

  const running_command_ref = useRef(running_command);
  useEffect(() => {
    running_command_ref.current = running_command;
  }, [running_command]);

  const pic_ref = useRef(pic);
  useEffect(() => {
    pic_ref.current = pic;
  }, [pic]);

  const request_cancel_ref = useRef(request_cancel);
  useEffect(() => {
    request_cancel_ref.current = request_cancel;
  }, [request_cancel]);

  const pause_ref = useRef(pause);
  useEffect(() => {
    pause_ref.current = pause;
  }, [pause]);

  const ws_ref = useRef(ws);
  useEffect(() => {
    ws_ref.current = ws;
  }, [ws]);

  const log_ref = useRef(log);
  useEffect(() => {
    log_ref.current = log;
  }, [log]);

  async function connect(first_time) {
    if (!first_time) set_ws(null)
    await wait(1000)
    console.log('connecting', props.printer.url, first_time)
    const ws = first_time ? props.printer.ws : new WebSocket(props.printer.url);
    ws.onopen = async () => {
      console.log('connected')
      await wait(2500);
      if (!first_time) set_ws(ws)
    }
    ws.onclose = () => {
      //set_ws(undefined)
      set_nozzle_temp(null)
      set_nozzle_temp_setpoint(null)
      set_bed_temp(null)
      set_bed_temp_setpoint(null)
    }
    ws.onmessage = (event) => {
      console.log(event.data, '<=', ws_ref.current)
      if (typeof event.data === 'string') {
        const state = parse_status(event.data)
        if (state.T) set_nozzle_temp(state.T);
        if (state.Ts) set_nozzle_temp_setpoint(state.Ts);
        if (state.B) set_bed_temp(state.B);
        if (state.Bs) set_bed_temp_setpoint(state.Bs);
        if (running_command_ref.current?.resolve_ok && state.ok) {
          running_command_ref.current.resolve_ok();
          running_command_ref.current = null
        }
        let log = [...log_ref.current];
        log[log.length-1][1] = event.data
        set_log(log)
      } else if (event.data instanceof ArrayBuffer) {
        if (pic_ref.current) URL.revokeObjectURL(pic_ref.current);
        set_pic(URL.createObjectURL(event.data));
      } else if (event.data instanceof Blob) {
          event.data.arrayBuffer().then(arrayBuffer => {
            if (pic_ref.current) URL.revokeObjectURL(pic_ref.current);
            set_pic(URL.createObjectURL(event.data));
          });
      } else {
          console.log('Unknown message type:', event.data);
      }
  };
    ws.onerror = (error) => {
      running_command_ref.current?.reject_ok(error);
      running_command_ref.current = null
    };
  }

  useEffect(() => {
    console.log('props.printer.ws', props.printer.ws, ws, ws_ref.current)
    connect(true)
    setTimeout(() => inquire(), 1000)
  }, []);

  function send_cmd(cmd) {
    return new Promise((resolve_ok, reject_ok) => _send_cmd(cmd, resolve_ok, reject_ok));
  }

  function _send_cmd(cmd, resolve_ok, reject_ok) {
    
    if (running_command_ref.current) {
      return setTimeout(()=>_send_cmd(cmd, resolve_ok, reject_ok), 1000)
    }
    set_running_command({cmd, resolve_ok, reject_ok})
    console.log(cmd, '=>', ws_ref.current)
    let log = log_ref.current.slice(-100);
    log.push([cmd,])
    if (cmd.trim().startsWith(';')) {
      resolve_ok()
      log[log.length-1][1] = 'ok'
      set_running_command(null)
    } else ws_ref.current.send(cmd);
    set_log(log)
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
    //while (!ws_ref.current) await wait(1000)
    //await send_cmd('M105')
  }

  async function handle_gcode(info) {
    console.log('info', info)
    set_file(info.file.status=='removed' ? null : info.file)
  }

  async function print(cmds) {
    set_request_print(true)
    set_print_exception(false)
    set_request_cancel(false)
    set_cancelled(false)
    set_pause(false)

    while (!ws_ref.current) {
      console.log('waiting for websocket')
      await wait(1000)
    }

    set_request_print(false)
    set_progress(0)
    set_print_started_at(Date.now())

    console.log('cmds', cmds)

    while (running_command) {
      console.log('waiting for currently running command to finish')
      await wait(1000);
    }

    try {
      await send_cmd('; printing '+file.name)
      for (let i=0; i<cmds.length; ++i) {
        while (pause_ref.current && !request_cancel_ref.current) {
          console.log('waiting to be unpaused')
          await wait(1000);
        }
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

  let connection_status = null;
  if (ws===undefined) connection_status = null
  else if (!ws) connection_status = <Spin size='small' style={{verticalAlign:'text-top', paddingLeft:'2pt'}}/>
  else connection_status = <a href={'http://'+props.printer.ip} target='_blank'><LinkOutlined /></a>

  const print_description = (
    <Space size="small">
      <PrinterTwoTone />
      <span style={{ color: 'gray', fontWeight: 'normal' }}>
        @ {props.printer.url} {connection_status}
      </span>
    </Space>
  )

  const progress_percent = progress== null || !cmds?.length ? null : Math.round(100*progress/cmds?.length)

  function close_action() {
    console.log('close_action', ws_ref.current)
    ws_ref.current?.close()
    props.remove(props.printer.url)
  }

  const actions = [];

  async function home() {
    await send_cmd('G28')
  }

  if (ws && !running_command) {
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

  if (file && ws && (progress==null || print_exception || progress_percent==100)) {
    actions.push(
      <ActionWithText key='clear' style={{color:'#ff7875'}} onActionClick={()=>set_file(null)} icon={<ClearOutlined />}>
        Clear
      </ActionWithText>
    )
  }

  if (progress!=null && progress_percent<100 && !cancelled && !request_cancel) {
    if (pause) actions.push(
      <Tooltip onActionClick={()=>set_pause(false)} title="Continue"><PlayCircleOutlined /></Tooltip>
    )
    else actions.push(
      <Tooltip onActionClick={()=>set_pause(true)} title="Pause"><PauseCircleOutlined /></Tooltip>
    )
    actions.push(
      <Popconfirm key='cancel' onActionClick={()=>{}} description="Are you sure you want to cancel?" onConfirm={()=>set_request_cancel(true)}>
        <ActionWithText style={{color:'#ff7875'}} icon={request_print ? <Spin/> : <StopOutlined />}>
          Cancel
        </ActionWithText>
      </Popconfirm>
    )
  }

  if (request_cancel) {
    actions.push(
      <ActionWithText key='cancelling' onActionClick={()=>{}} icon={<LoadingOutlined spin />}>
        Cancelling
      </ActionWithText>
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
    <input type='file' ref={hidden_upload_ref} 
      onChange={e => set_file(e.target.files[0]) || (e.target.value='')} 
      beforeUpload={()=>false} style={{display:'none'}}
      accept='.gcode'
    />
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

  function do_manual_cmd_entry() {
    set_manual_cmd_entry('')
    send_cmd(manual_cmd_entry)
  }

  return (
    <Col xs={24} sm={24} md={24} lg={24}>
      <Card actions={actionClicks(actions)} style={{boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',}}>

        <Flex vertical align='center' gap='small'>

          {print_description}

          {pic ? <img src={pic} />: null}

          {ws===undefined ? <Alert message="Printer Disconnected" type="error" showIcon /> : null}

          {(info && Object.keys(info)) || file?.name ? null : <PrinterOutlined style={{fontSize:'120pt', paddingTop:'20pt', color:'#ddd'}} />}
  
          <Descriptions column={{ xs: 1, sm: 1, md: 2, lg:2}} size='small' style={{marginTop:'.5em'}}>
            {file?.name ? <Descriptions.Item label="File">
              {file?.name}
            </Descriptions.Item> : null}
            {info?.['TARGET_MACHINE.NAME'] ? <Descriptions.Item label="Target">
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
            {thumbnail ? <Descriptions.Item label="Preview">
              <div>{thumbnail ? <img src={'data:image/png;base64,'+thumbnail} style={{verticalAlign:'middle', maxHeight:'32pt'}}/> : null}</div>
            </Descriptions.Item> : null}
          </Descriptions>

          {progress==null ? null : <Progress percent={progress_percent} status={print_exception ? 'exception' : null} />}

          {!log?.length ? null : 
            <Collapse items={[{
              key: 'log',
              label: <code style={{fontSize:'smaller'}}><CodeOutlined /> {show_status(log[log.length-1])}</code>,
              children: <>
                <pre style={{margin:0, fontSize:'smaller', maxHeight:'10em', overflowY:'scroll'}}><code>
                  {log.map((line,i)=>(<div key={i}>{line[0]} <ArrowRightOutlined /> {line[1] ? line[1] : <Spin size='small'/>}</div>))}
                </code></pre>
              </>,
            }]} style={{width:'100%'}}  size='small' />
          }

          <Input 
            className='cmd-input' size="small"
            id='cmd-input'
            addonAfter={<SendOutlined onClick={()=>do_manual_cmd_entry()} />} 
            placeholder="Enter G-Code..." 
            prefix={<CodeOutlined />} 
            defaultValue={''}
            value={manual_cmd_entry}
            onChange={e=>set_manual_cmd_entry(e.target.value)}
            onPressEnter={(e)=>do_manual_cmd_entry()}
          />

          {hidden_upload}

        </Flex>
      </Card>

    </Col>

  )
}

function show_status(log_entry) {
  let status = <Spin size='small'/>
  if (log_entry[1]?.toLowerCase().startsWith('error:') || log_entry[1]?.toLowerCase().startsWith('echo:')) status = <><ArrowRightOutlined /> <CloseOutlined style={{color:"red"}} /> {log_entry[1]}</>
  if (log_entry[1]?.toLowerCase().startsWith('echo:')) status = <><ArrowRightOutlined /> <CloseOutlined style={{color:"red"}} /> {log_entry[1].slice(5)}</>
  if (log_entry[1]?.split(' ')[0]=='ok') status = <CheckOutlined style={{color:"green"}} />
  return <>
    {log_entry[0]}&nbsp;
    {status}
  </>
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

function parse_status(str) {
  // like: ok N0 P15 B15 T:25.2 /0.0 B:23.1 /0.0 T0:25.2 /0.0 @:0 B@:0
  const pairs = str.split(' ')
  const result = {};
  let last_key = null
  pairs.forEach(pair => {
    try {
      const [key, value] = pair.split(':')
      result[key] = parseFloat(value)
      if (last_key && key.startsWith('/')) result[last_key+'s'] = parseFloat(key.slice(1))
      last_key = key
    } catch (error) {
      console.log('could not parse status pair', pair)
    }
  });
  result.ok = str.startsWith('ok')
  return result;
}


