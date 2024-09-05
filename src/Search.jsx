import { useState, useEffect, useRef } from 'react'
import { Card, Col, Button, Flex, Space, Input, Progress } from 'antd';
import {
  SearchOutlined, PlusOutlined, ClusterOutlined, ApiOutlined, LinkOutlined, CloseCircleOutlined, StopOutlined, PrinterTwoTone, InfoCircleOutlined
} from '@ant-design/icons';

import {actionClicks, ActionWithText } from './AntdActionUtils'
import {wait} from './util'


export function Search(props) {

  const [adding_ip, set_adding_ip] = useState(false)
  const [search_progress, set_search_progress] = useState(null)
  const [local_ip, set_local_ip] = useState('')
  const [ip_and_port, set_ip_and_port] = useState('')
  const [dismissed, set_dismissed] = useState(false)
  const [found_some, set_found_some] = useState(0)

  const found_some_ref = useRef(found_some);
  useEffect(() => {
    found_some_ref.current = found_some;
  }, [found_some]);

  function reset() {
    set_adding_ip(false)
    set_search_progress(null)
    set_local_ip('')
    set_ip_and_port('')
  }

  const search_progress_ref = useRef(null)
  useEffect(() => {
    search_progress_ref.current = search_progress;
  }, [search_progress]);

  useEffect(()=>{
    getLocalIP().then((ip) => {
      console.log("Local IP Address:", ip);
      set_local_ip(ip)
    }).catch((error) => {
      console.error("Error:", error.message);
    });
  }, [])

  const full_ip = ip_and_port.match(ipRegex)
  const subnet = ip_and_port.match(/([0-9]{1,3}\.){3}[xX]{1,3}/)

  let search_button = <StopOutlined />
  if (full_ip) search_button = <LinkOutlined />
  if (subnet) search_button = <SearchOutlined />
  if (search_progress!=null) search_button = null;

  function add_printer(ws, url) {
    wait(2500).then(()=>props.add_printer(ws, url))
    set_adding_ip(false)
    set_found_some(found_some_ref.current+1)
  }

  async function search(ip_and_port) {
    set_search_progress(0)
    set_found_some(0)
    const [a,b,c,d] = ip_and_port.split('.')
    console.log('[a,b,c,d]', [a,b,c,d])
    const to_search = Array.from({ length: 253 }, (_, i) => i + 2);
    console.log('to_search',to_search)
    try {
      const discovered_printers = await Promise.all(to_search.map(d=>{
        return new Promise((resolve, reject) => {
          const ip = [a,b,c,d].join('.')
          const url = 'ws://'+ ip +':81'
          //console.log('connecting', url)

          const ws = new WebSocket(url);

          const timeoutId = setTimeout(() => {
            ws.close(); // Close the WebSocket connection
            reject(new Error('WebSocket connection timed out'));
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
            resolve()
          }      

        })
      }))
      console.log('discovered_printers', discovered_printers)
    } catch (error) {
      console.log('search done', error)
    } finally {
      console.log('search finally')
      set_search_progress(null)
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

  if (search_progress==253) {
    actions.push(
      <ActionWithText key='search' onActionClick={()=>reset()} icon={<SearchOutlined />}>
        Search Again
      </ActionWithText>
    )
  }

  if (props.printer_count && search_progress==253) {
    actions.push(
      <ActionWithText key='dismiss' onActionClick={()=>set_dismissed(true)} icon={<CloseCircleOutlined />}>
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
          
          {search_progress==null ? (
            <>
              <div>
                Enter an ip/port (<code style={{fontSize:'smaller'}}>192.168.0.57[:81]</code>)
                or subnet (<code style={{fontSize:'smaller'}}>192.168.0.x</code>) to search.
              </div>
              <Input.Search 
                addonBefore="ws://" 
                placeholder="192.168.0.57[:81]" 
                allowClear 
                loading={search_progress!=null}
                disabled={search_progress!=null}
                enterButton={search_button} 
                defaultValue={local_ip}
                onChange={(e)=>console.log(e) || set_ip_and_port(e.target.value)}
                onSearch={(value)=>search_or_add_printer(value)}
              />
              <div style={{wordBreak:'break-word'}}>Or try one of these common subnets: <JoinWithComma components={subnet_buttons} /></div>
            </>
          ) : (
            <>
              {search_progress<253 ? 'Searching '+ip_and_port.toLowerCase()+'...' : null}
              {search_progress==253 && found_some==0 ? <div>
                Sorry, no printers found.  Are they on? Did you select the right subnet? <a href='https://nordvpn.com/blog/what-is-a-subnet-mask/#:~:text=you%E2%80%99re%20connected%20to.-,How%20do%20you%20find%20the%20subnet%20mask%3F,-Follow%20the%20guides' target='_blank'><InfoCircleOutlined /></a>
              </div> : null}
              <Progress type="circle" percent={Math.round(100*search_progress/254)} />
            </>
          )}

        </Flex>
      </Card>

    </Col>

  )
}

// doesn't work for my browser, which returns a 'XXX.local' hostname
const ipRegex = /([0-9]{1,3}\.){3}[0-9]{1,3}/;
async function getLocalIP() {
  return new Promise((resolve, reject) => {
    const pc = new RTCPeerConnection();
    const noop = () => {};

    pc.createDataChannel(""); // Create a data channel

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate.candidate;
        console.log('candidate', candidate)
        const ipAddress = candidate.match(ipRegex)[0];
        resolve(ipAddress);
        pc.onicecandidate = noop;
      }
    };

    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch((error) => reject(error));

    // Fallback in case we don't get an IP address
    setTimeout(() => {
      reject(new Error("Could not retrieve IP address"));
    }, 1000);
  });
}

function JoinWithComma({ components }) {
  return components.reduce((acc, component, index) => {
    if (index === 0) {
      return [component];
    } else {
      return [...acc, ',', component];
    }
  }, []);
}
