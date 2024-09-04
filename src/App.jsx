import { useState } from 'react'
import { Card, Col, Row } from 'antd';

import { Search } from './Search'
import { Printer } from './Printer'

const printers = [
  { ip:'192.168.68.57', port:81 },
  // Add more cards as needed
];


function App() {
  const [count, setCount] = useState(0)

  return (
    <Row gutter={[16, 16]}>
      {printers.map((printer, i) => <Printer key={i} printer={printer} />)}
      <Search />
    </Row>
  )
}

export default App
