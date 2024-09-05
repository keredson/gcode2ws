import { useState, useEffect, useRef } from 'react'
import { Card, Col, Button, Flex, Space, Input, Progress } from 'antd';
import {
  SearchOutlined, PlusOutlined, ClusterOutlined, ApiOutlined, LinkOutlined, CloseCircleOutlined, StopOutlined, PrinterTwoTone, InfoCircleOutlined
} from '@ant-design/icons';

import {actionClicks, ActionWithText } from './AntdActionUtils'
import {HTTPS} from './util'


export function Search(props) {

  const [search_progress, set_search_progress] = useState(null)
  const [ip_and_port, set_ip_and_port] = useState('')
  const [dismissed, set_dismissed] = useState(false)
  const [found_some, set_found_some] = useState(0)

  const search_in_progress = !dismissed && search_progress!=null && search_progress<253
  const search_done = search_progress==253

  const found_some_ref = useRef(found_some);
  useEffect(() => {
    found_some_ref.current = found_some;
  }, [found_some]);

  function search_again() {
    set_search_progress(null)
    set_ip_and_port('')
    set_dismissed(false)
  }

  function dismiss() {
    set_dismissed(true)
  }

  const search_progress_ref = useRef(null)
  useEffect(() => {
    search_progress_ref.current = search_progress;
  }, [search_progress]);

  const full_ip = ip_and_port.match(ipRegex)
  const subnet = !HTTPS && ip_and_port.match(/([0-9]{1,3}\.){3}[xX]{1,3}/)

  let search_button = <StopOutlined />
  if (full_ip) search_button = <LinkOutlined />
  if (subnet) search_button = <SearchOutlined />
  if (search_in_progress) search_button = null;

  function add_printer(ws, url) {
    console.log('add_printer...', ws, url)
    //wait(2500).then(()=>props.add_printer(ws, url))
    props.add_printer(ws, url)
    set_found_some(found_some_ref.current+1)
  }

  async function search(ip_and_port) {
    set_search_progress(0)
    set_found_some(0)
    set_dismissed(false)
    const [a,b,c,d] = ip_and_port.split('.')
    console.log('[a,b,c,d]', [a,b,c,d])
    const to_search = Array.from({ length: 253 }, (_, i) => i + 2);
    console.log('to_search',to_search)
    try {
      const discovered_printers = await Promise.all(to_search.map(d=>{
        return new Promise((resolve, reject) => {
          const ip = [a,b,c,d].join('.')
          const url = 'ws://'+ ip +':81'

          const ws = new WebSocket(url);

          console.log('search connected', url, ws)

          const timeoutId = setTimeout(() => {
            console.log('close timeout', ws)
            ws.close()
          }, 10000);

          ws.onopen = () => {
            clearTimeout(timeoutId);
            set_search_progress(search_progress_ref.current+1)
            resolve(ip)
            console.log('found', ip)
            add_printer(ws, url)
          }
          ws.onclose = () => {
            set_search_progress(search_progress_ref.current+1)
            resolve(new Error('WebSocket connection timed out', ws))
          }      

        })
      }))
      console.log('discovered_printers', discovered_printers)
    } catch (error) {
      console.log('search done', error)
    }
  }

  function search_or_add_printer(ip_and_port) {
    if (subnet) search(ip_and_port);
    else if (full_ip) add_printer(ip_and_port);
    else alert("Please enter and ip/port (like 192.168.0.57 or 192.168.0.57:81) or a subnet (like 192.168.0.X).");
  }

  const subnet_buttons = ['10.0.0.x','192.168.0.x','192.168.1.x','192.168.68.x',].map(subnet => (
    <a href='#' onClick={(e)=>{
      e.preventDefault()
      set_ip_and_port(subnet)
      search(subnet)
    }} style={{fontSize:'smaller', color:'#333', wordBreak:'none'}}>{subnet}</a>
  ))

  const actions = [];

  if (search_done) {
    actions.push(
      <ActionWithText key='search' onActionClick={()=>search_again()} icon={<SearchOutlined />}>
        Search Again
      </ActionWithText>
    )
  }

  if (props.printer_count) {
    actions.push(
      <ActionWithText key='dismiss' onActionClick={()=>dismiss()} icon={<CloseCircleOutlined />}>
        Dismiss
      </ActionWithText>
    )
  }


  if (dismissed && props.printer_count>0) return


  return (
    <Col xs={24} sm={24} md={24} lg={24}>
      <Card actions={actionClicks(actions)} style={{
        border: '1px dashed silver', // Dashed outline
        //backgroundColor: 'transparent', // Transparent background
        boxShadow: 'none', // Remove any shadow if you want a flat look
        color: 'gray',
        textAlign:'center'
      }}
      >
        <Flex vertical align='center' gap='middle'>
          <div style={{fontSize:'16pt'}}><PlusOutlined/> <PrinterTwoTone /></div>
          
          {search_in_progress || search_done ? null : (
            <>
              <div>
                Enter an ip/port (<code style={{fontSize:'smaller'}}>192.168.0.57[:81]</code>)&nbsp;
                {HTTPS ? null : <span>or subnet (<code style={{fontSize:'smaller'}}>192.168.0.x</code>) to search</span>}.
              </div>
              <Input.Search 
                addonBefore={HTTPS ? 'wss://' : "ws://"}
                placeholder="192.168.0.57[:81]" 
                allowClear 
                loading={search_in_progress}
                disabled={search_in_progress}
                enterButton={search_button} 
                onChange={(e)=>console.log(e) || set_ip_and_port(e.target.value)}
                onSearch={(value)=>search_or_add_printer(value)}
              />
              <div style={{wordBreak:'break-word'}}>
                { HTTPS ? <span>
                  Subnet search is unavailable over HTTPS. <a href='https://www.cloudflare.com/learning/ssl/what-is-mixed-content/' target='_blank'><InfoCircleOutlined /></a> &nbsp; <Button size='small' onClick={() => window.location = 'http://'+window.location}>Go HTTP</Button>
                </span> : <span>
                  Or try one of these common subnets: <JoinWithComma components={subnet_buttons} />
                </span> }
              </div>
            </>
          )}
          { search_in_progress && !search_done ? (
            <>
              {search_in_progress ? 'Searching '+ip_and_port.toLowerCase()+'...' : null}
            </>
          ) : null}
          { search_progress || search_done ? (
            <Progress type="circle" percent={Math.round(100*search_progress/253)} />
          ) : null}
          { search_done ? (
            <>
              {found_some==0 ? <div>
                Sorry, no printers found.  Are they on? Did you select the right subnet? <a href='https://nordvpn.com/blog/what-is-a-subnet-mask/#:~:text=you%E2%80%99re%20connected%20to.-,How%20do%20you%20find%20the%20subnet%20mask%3F,-Follow%20the%20guides' target='_blank'><InfoCircleOutlined /></a>
              </div> : null}
            </>
          ) : null}

        </Flex>
      </Card>

    </Col>

  )
}

const ipRegex = /([0-9]{1,3}\.){3}[0-9]{1,3}/;

function JoinWithComma({ components }) {
  return components.reduce((acc, component, index) => {
    if (index === 0) {
      return [component];
    } else {
      return [...acc, ',', component];
    }
  }, []);
}
