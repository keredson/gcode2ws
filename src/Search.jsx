import { useState } from 'react'
import { Card, Col, Button, Flex, Space } from 'antd';
import {
  SearchOutlined, PlusOutlined, ClusterOutlined
} from '@ant-design/icons';

export function Search(props) {
  return (
    <Col xs={24} sm={12} md={8} lg={6}>
      <Card style={{
        border: '1px dashed silver', // Dashed outline
        backgroundColor: 'transparent', // Transparent background
        boxShadow: 'none', // Remove any shadow if you want a flat look
        color: 'gray',
        textAlign:'center'
      }}
      >
        <Flex vertical align='center' gap='middle'>
          <SearchOutlined style={{fontSize:'40pt'}}/>
          <Space>
            <Button type="text" iconPosition='end'>Search</Button>
          </Space>
        </Flex>
      </Card>

    </Col>

  )
}