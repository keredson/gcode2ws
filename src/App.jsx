import { useState, useEffect, useRef } from 'react'
import { Card, Col, Row } from 'antd';

import { Search } from './Search'
import { Printer } from './Printer'


function App() {
  const [printers, set_printers] = useState([])

  const printers_ref = useRef(null)
  useEffect(() => {
    printers_ref.printers = printers;
  }, [printers]);

  function add_printer(ip, port) {
    console.log('app adding printer', ip, port, printers_ref.printers)
    let new_printers = [...printers_ref.printers]
    new_printers.push({ ip, port:port||81 })
    set_printers(new_printers)
  }

  return (
    <Row gutter={[16, 16]}>
      {printers.map((printer, i) => <Printer key={i} printer={printer} />)}
      <Search add_printer={(ip, port)=>add_printer(ip, port)} />
    </Row>
  )
}

export default App
