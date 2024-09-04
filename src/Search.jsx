import { useState } from 'react'
import { Card, Col, Button, Flex, Space, Input } from 'antd';
import {
  SearchOutlined, PlusOutlined, ClusterOutlined, ApiOutlined, LinkOutlined, CloseCircleOutlined
} from '@ant-design/icons';


export function Search(props) {

  const [adding_ip, set_adding_ip] = useState(false)

  function add_printer(ip_and_port) {
    let [ip, port] = ip_and_port.split(':')
    if (port) port = parseInt(port)
    props.add_printer(ip, port)
    set_adding_ip(false)
  }

  return (
    <Col xs={24} sm={12} md={8} lg={6}>
      <Card style={{
        border: '1px dashed silver', // Dashed outline
        //backgroundColor: 'transparent', // Transparent background
        boxShadow: 'none', // Remove any shadow if you want a flat look
        color: 'gray',
        textAlign:'center'
      }}
      >
        <Flex vertical align='center' gap='middle'>
          <PlusOutlined style={{fontSize:'40pt'}}/>
          {adding_ip ? (
            <Space>
                <Input.Search 
                  addonBefore="ws://" 
                  placeholder="192.168.0.57[:81]" 
                  allowClear 
                  enterButton={<LinkOutlined />} 
                  onSearch={(value)=>add_printer(value)}
                />
                <Button type='text' onClick={()=>set_adding_ip(false)} icon={<CloseCircleOutlined />}></Button>
            </Space>
          ) : (
            <Button type="text" icon={<LinkOutlined />} onClick={()=>set_adding_ip(true)}>Connect by IP Address</Button>
          )}
          <Space>
            <Button type="text" icon={<SearchOutlined />}>Search Local Network</Button>
          </Space>
        </Flex>
      </Card>

    </Col>

  )
}