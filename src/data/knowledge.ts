import { courseOptions, getCourseLabel } from "@/data/courses";
import type { CourseId, KnowledgeItem } from "@/types/learning";

export const knowledgeItems: KnowledgeItem[] = [
  {
    id: "complex-functions",
    course: "math-physics",
    title: "复变函数",
    alias: ["解析函数", "留数定理", "complex functions"],
    description:
      "复变函数研究复平面上的函数、解析性和围道积分。物理中常用它处理势函数、积分计算和特殊函数的解析性质。",
    textbookStyleSummary:
      "应先明确解析函数的 Cauchy-Riemann 条件，再使用 Cauchy 积分定理、积分公式和留数定理。围道积分的结论依赖奇点类型、积分路径和函数在区域内的解析性。",
    prerequisites: [],
    related: ["积分变换", "特殊函数", "Green 函数"],
    typicalProblems: ["判定函数解析性", "用留数定理计算实积分", "求 Laurent 展开和留数"],
    keyFormulas: [
      "\\frac{\\partial u}{\\partial x}=\\frac{\\partial v}{\\partial y},\\quad \\frac{\\partial u}{\\partial y}=-\\frac{\\partial v}{\\partial x}",
      "\\oint_C f(z)\\,dz=2\\pi i\\sum_k \\operatorname{Res}(f,z_k)",
    ],
    commonMisunderstandings: ["把可微与解析混为一谈", "忽略围道内外奇点位置", "把孤立奇点和支点按同一方式处理"],
    studyOrder: 1,
    difficulty: "basic",
    tags: ["解析性", "围道积分", "留数"],
  },
  {
    id: "fourier-series-transform",
    course: "math-physics",
    title: "Fourier 级数与 Fourier 变换",
    alias: ["傅里叶级数", "傅里叶变换", "Fourier transform"],
    description:
      "Fourier 方法把函数表示为正交基函数的线性组合。它是处理线性偏微分方程、边界条件和频谱分析的基本工具。",
    textbookStyleSummary:
      "Fourier 级数适用于有限区间上的周期展开，Fourier 变换适用于无限区间上的连续谱展开。使用时必须说明函数空间、正交区间、归一化约定和收敛意义。",
    prerequisites: ["复变函数", "常微分方程"],
    related: ["分离变量法", "Sturm-Liouville 本征值问题", "积分变换"],
    typicalProblems: ["函数的正弦级数或余弦级数展开", "求 Fourier 变换与逆变换", "用谱分解求热传导或波动方程"],
    keyFormulas: [
      "f(x)\\sim \\frac{a_0}{2}+\\sum_{n=1}^{\\infty}(a_n\\cos nx+b_n\\sin nx)",
      "\\hat f(k)=\\int_{-\\infty}^{\\infty} f(x)e^{-ikx}\\,dx",
    ],
    commonMisunderstandings: ["忽略端点处收敛到左右极限平均值", "混用不同归一化约定", "把周期展开和全空间变换混为一谈"],
    studyOrder: 2,
    difficulty: "basic",
    tags: ["正交展开", "频谱", "积分变换"],
  },
  {
    id: "laplace-transform",
    course: "math-physics",
    title: "Laplace 变换",
    alias: ["拉普拉斯变换", "Laplace transform"],
    description:
      "Laplace 变换常用于线性常微分方程和初值问题。它把微分运算转化为复变量代数运算。",
    textbookStyleSummary:
      "Laplace 变换的使用前提是函数满足适当增长条件，并且初始条件随导数变换公式进入代数方程。反演时需注意极点、收敛域和单位阶跃函数的移位性质。",
    prerequisites: ["常微分方程", "复变函数"],
    related: ["积分变换", "数学物理方程", "Green 函数"],
    typicalProblems: ["求解带初始条件的线性微分方程", "处理阶跃激励和冲量响应", "求卷积形式的系统响应"],
    keyFormulas: [
      "\\mathcal{L}\\{f'(t)\\}=sF(s)-f(0)",
      "\\mathcal{L}\\{f*g\\}=F(s)G(s)",
    ],
    commonMisunderstandings: ["漏写初值项", "把 Laplace 变量与空间坐标混淆", "只做正变换而不检查反演结果的定义域"],
    studyOrder: 3,
    difficulty: "basic",
    tags: ["初值问题", "卷积", "响应函数"],
  },
  {
    id: "integral-transforms",
    course: "math-physics",
    title: "积分变换",
    alias: ["Fourier 变换", "Laplace 变换", "Mellin 变换"],
    description:
      "积分变换用核函数把原函数映射到新的变量空间。它常用于把微分方程化为代数方程或常微分方程。",
    textbookStyleSummary:
      "选择变换类型取决于自变量范围、边界条件和源项形式。求解后必须通过逆变换回到原变量，并检查初始条件、边界条件和收敛条件。",
    prerequisites: ["Fourier 级数与 Fourier 变换", "Laplace 变换"],
    related: ["数学物理方程", "Green 函数"],
    typicalProblems: ["用 Fourier 变换解 Poisson 方程", "用 Laplace 变换处理热传导初值问题", "利用卷积定理求响应"],
    keyFormulas: ["\\mathcal{T}\\{f\\}(s)=\\int K(s,x)f(x)\\,dx"],
    commonMisunderstandings: ["没有说明变换核和归一化", "忽略边界项", "把变换域中的乘法直接当作原空间乘法"],
    studyOrder: 4,
    difficulty: "intermediate",
    tags: ["变换核", "逆变换", "卷积"],
  },
  {
    id: "mathematical-physics-equations",
    course: "math-physics",
    title: "数学物理方程",
    alias: ["偏微分方程", "PDE", "三类典型方程"],
    description:
      "数学物理方程主要包括波动方程、热传导方程和 Laplace/Poisson 方程。学习重点是方程类型、定解条件和物理量含义。",
    textbookStyleSummary:
      "方程本身只描述局部关系，定解问题还必须给出区域、边界条件和初始条件。双曲型、抛物型和椭圆型方程对应不同物理过程，解法也不同。",
    prerequisites: ["Fourier 级数与 Fourier 变换", "常微分方程"],
    related: ["定解问题", "分离变量法", "Green 函数"],
    typicalProblems: ["弦振动方程定解问题", "热传导方程初边值问题", "Poisson 方程边值问题"],
    keyFormulas: [
      "\\frac{\\partial^2 u}{\\partial t^2}=a^2\\nabla^2u",
      "\\frac{\\partial u}{\\partial t}=a^2\\nabla^2u",
      "\\nabla^2 u=-\\rho/\\varepsilon_0",
    ],
    commonMisunderstandings: ["只写方程而不写定解条件", "把初始条件和边界条件混用", "不区分齐次方程与非齐次方程"],
    studyOrder: 5,
    difficulty: "intermediate",
    tags: ["波动方程", "热传导方程", "Poisson 方程"],
  },
  {
    id: "well-posed-problems",
    course: "math-physics",
    title: "定解问题",
    alias: ["初边值问题", "boundary value problem", "initial-boundary value problem"],
    description:
      "定解问题由方程、求解区域、初始条件和边界条件共同构成。它决定解的唯一性、稳定性和物理可解释性。",
    textbookStyleSummary:
      "同一个微分方程在不同边界条件下代表不同物理系统。处理定解问题时应先判断方程类型，再写清 Dirichlet、Neumann 或 Robin 边界条件以及初始条件。",
    prerequisites: ["数学物理方程"],
    related: ["分离变量法", "Green 函数", "静电边值问题"],
    typicalProblems: ["给定区域内的 Laplace 方程边值问题", "弦振动初边值问题", "热传导混合边界问题"],
    keyFormulas: ["u|_{\\partial\\Omega}=f", "\\frac{\\partial u}{\\partial n}\\bigg|_{\\partial\\Omega}=g"],
    commonMisunderstandings: ["把边界上的函数值和法向导数条件混淆", "忽略区域几何对解法的限制", "没有检查解是否满足全部条件"],
    studyOrder: 6,
    difficulty: "intermediate",
    tags: ["初始条件", "边界条件", "适定性"],
  },
  {
    id: "separation-of-variables",
    course: "math-physics",
    title: "分离变量法",
    alias: ["变量分离法", "separation of variables"],
    description:
      "分离变量法把线性齐次定解问题化为若干常微分本征值问题。它依赖区域几何、边界条件和本征函数展开。",
    textbookStyleSummary:
      "分离常数不是任意参数，而由边界条件确定为本征值。本征函数的正交归一性和完备性保证可用级数展开初始条件或非齐次项。",
    prerequisites: ["定解问题", "Fourier 级数与 Fourier 变换"],
    related: ["Sturm-Liouville 本征值问题", "特殊函数", "静电边值问题"],
    typicalProblems: ["矩形区域 Laplace 方程", "有限长杆热传导方程", "圆柱或球坐标下的定解问题"],
    keyFormulas: ["u(x,t)=X(x)T(t)", "X''+\\lambda X=0"],
    commonMisunderstandings: ["把分离常数符号随意选取", "没有使用边界条件确定本征值", "展开系数未按正交归一关系计算"],
    studyOrder: 7,
    difficulty: "intermediate",
    tags: ["本征值", "正交展开", "边界条件"],
  },
  {
    id: "sturm-liouville",
    course: "math-physics",
    title: "Sturm-Liouville 本征值问题",
    alias: ["Sturm-Liouville 理论", "自伴本征值问题"],
    description:
      "Sturm-Liouville 问题给出一类自伴微分算符的本征值和本征函数。它解释许多正交函数系的来源。",
    textbookStyleSummary:
      "标准形式中的权函数、边界条件和自伴性决定本征值实性、本征函数正交性以及展开的适用条件。它是分离变量法的数学基础。",
    prerequisites: ["分离变量法", "线性代数"],
    related: ["特殊函数", "Green 函数", "力学量算符"],
    typicalProblems: ["判断算符自伴性", "求本征值和本征函数", "按权函数正交关系展开函数"],
    keyFormulas: [
      "\\frac{d}{dx}\\left[p(x)\\frac{dy}{dx}\\right]+[\\lambda w(x)-q(x)]y=0",
      "\\int_a^b w(x)y_m(x)y_n(x)\\,dx=0\\quad(m\\ne n)",
    ],
    commonMisunderstandings: ["漏掉权函数", "把正交性与归一化混为一谈", "忽略边界条件对自伴性的作用"],
    studyOrder: 8,
    difficulty: "advanced",
    tags: ["自伴算符", "权函数", "完备性"],
  },
  {
    id: "green-functions",
    course: "math-physics",
    title: "Green 函数",
    alias: ["格林函数", "Green's function", "响应函数"],
    description:
      "Green 函数是线性算符对单位源的响应。它把源项、边界条件和线性叠加原理联系起来。",
    textbookStyleSummary:
      "Green 函数满足含 delta 函数的辅助方程，并服从与原问题相容的边界条件。求解非齐次问题时，解写成源项与 Green 函数的积分叠加。",
    prerequisites: ["定解问题", "Sturm-Liouville 本征值问题"],
    related: ["静电边值问题", "散射理论", "涨落理论"],
    typicalProblems: ["构造一维 Green 函数", "用镜像法求静电 Green 函数", "用本征函数展开 Green 函数"],
    keyFormulas: ["LG(x,x')=\\delta(x-x')", "u(x)=\\int G(x,x')f(x')\\,dx'"],
    commonMisunderstandings: ["只把 Green 函数理解为公式而忽略边界条件", "混淆源点变量和场点变量", "忽略 delta 函数导致的导数跃变条件"],
    studyOrder: 9,
    difficulty: "advanced",
    tags: ["响应函数", "delta 函数", "线性算符"],
  },
  {
    id: "special-functions",
    course: "math-physics",
    title: "特殊函数",
    alias: ["Legendre 函数", "Bessel 函数", "Hermite 多项式"],
    description:
      "特殊函数通常来自具有特定坐标对称性的本征值问题。它们在球坐标、柱坐标和量子定态问题中反复出现。",
    textbookStyleSummary:
      "学习特殊函数时应从微分方程、边界条件和正交关系出发，而不只是记函数表。递推关系和母函数主要用于计算展开系数和化简积分。",
    prerequisites: ["Sturm-Liouville 本征值问题", "分离变量法"],
    related: ["中心力场", "一维定态问题", "静电边值问题"],
    typicalProblems: ["球坐标下 Legendre 多项式展开", "柱坐标下 Bessel 函数零点问题", "谐振子中的 Hermite 多项式"],
    keyFormulas: [
      "\\frac{d}{dx}\\left[(1-x^2)\\frac{dP_l}{dx}\\right]+l(l+1)P_l=0",
      "x^2J_n''+xJ_n'+(x^2-n^2)J_n=0",
    ],
    commonMisunderstandings: ["脱离坐标系和边界条件记忆公式", "忽略零点决定本征值", "把不同归一化约定混用"],
    studyOrder: 10,
    difficulty: "advanced",
    tags: ["Legendre", "Bessel", "正交多项式"],
  },
  {
    id: "variational-method-basics",
    course: "math-physics",
    title: "变分法基础",
    alias: ["Euler-Lagrange 方程", "泛函极值"],
    description:
      "变分法研究泛函在函数空间中的极值条件。它是分析力学、场论和量子变分法的共同数学工具。",
    textbookStyleSummary:
      "泛函取极值时，一阶变分为零给出 Euler-Lagrange 方程；边界条件决定允许变分的形式。计算时要区分普通函数极值和泛函极值。",
    prerequisites: ["微积分", "常微分方程"],
    related: ["Lagrange 方程", "Hamilton 原理", "量子变分法"],
    typicalProblems: ["由泛函推导 Euler-Lagrange 方程", "处理固定端点变分", "求最短曲线或最小作用量条件"],
    keyFormulas: ["\\delta J[y]=0", "\\frac{\\partial F}{\\partial y}-\\frac{d}{dx}\\frac{\\partial F}{\\partial y'}=0"],
    commonMisunderstandings: ["把变分符号当作普通微分", "没有说明端点条件", "忽略边界项"],
    studyOrder: 11,
    difficulty: "intermediate",
    tags: ["泛函", "Euler-Lagrange", "极值条件"],
  },
  {
    id: "particle-mechanics",
    course: "theoretical-mechanics",
    title: "质点力学",
    alias: ["Newton 力学", "Newtonian mechanics"],
    description:
      "质点力学以 Newton 定律为基础，研究单个质点在给定力场中的运动。它提供守恒律和轨道问题的基本语言。",
    textbookStyleSummary:
      "建立方程前应明确参考系、受力和约束。Newton 表述直接使用力和加速度，适合自由度较少且约束简单的问题。",
    prerequisites: [],
    related: ["中心力问题", "非惯性系", "Lagrange 方程"],
    typicalProblems: ["一维变力运动", "中心力场轨道方程", "能量和角动量守恒问题"],
    keyFormulas: ["m\\ddot{\\boldsymbol r}=\\boldsymbol F", "E=T+V", "\\boldsymbol L=\\boldsymbol r\\times\\boldsymbol p"],
    commonMisunderstandings: ["没有说明参考系是否惯性", "把约束力方向预设错误", "守恒律使用前不检查对称性或外力矩"],
    studyOrder: 1,
    difficulty: "basic",
    tags: ["Newton 方程", "守恒律", "轨道"],
  },
  {
    id: "system-of-particles",
    course: "theoretical-mechanics",
    title: "质点系",
    alias: ["多质点系统", "center of mass"],
    description:
      "质点系讨论多个质点的总动量、质心运动、角动量和能量关系。内力与外力的区分是分析的起点。",
    textbookStyleSummary:
      "质心运动由外力决定，系统角动量变化由外力矩决定。内力是否成对等大反向以及是否沿连线会影响角动量和能量分析。",
    prerequisites: ["质点力学"],
    related: ["刚体动力学", "虚功原理"],
    typicalProblems: ["质心运动定理", "碰撞问题", "变质量问题的动量分析"],
    keyFormulas: ["M\\ddot{\\boldsymbol R}=\\sum \\boldsymbol F_{\\rm ext}", "\\frac{d\\boldsymbol L}{dt}=\\boldsymbol M_{\\rm ext}"],
    commonMisunderstandings: ["把系统内力误计入总外力", "碰撞问题中滥用机械能守恒", "混淆质心系和实验室系"],
    studyOrder: 2,
    difficulty: "basic",
    tags: ["质心", "动量", "角动量"],
  },
  {
    id: "central-force",
    course: "theoretical-mechanics",
    title: "中心力问题",
    alias: ["Kepler 问题", "effective potential"],
    description:
      "中心力问题利用角动量守恒把三维运动化为平面径向运动。有效势能用于判断轨道类型和稳定性。",
    textbookStyleSummary:
      "中心力只沿径向，力矩为零，因此角动量守恒。轨道方程通常用 $u=1/r$ 化简，能量积分给出径向运动的允许区域。",
    prerequisites: ["质点力学"],
    related: ["Hamilton 方程", "散射理论"],
    typicalProblems: ["平方反比引力轨道", "有效势能分析", "Rutherford 散射的经典模型"],
    keyFormulas: ["m(\\ddot r-r\\dot\\theta^2)=F(r)", "V_{\\rm eff}(r)=V(r)+\\frac{L^2}{2mr^2}"],
    commonMisunderstandings: ["把径向力误认为径向速度不变", "忽略角动量守恒带来的平面运动", "不区分真实势能和有效势能"],
    studyOrder: 3,
    difficulty: "intermediate",
    tags: ["中心力", "有效势", "轨道方程"],
  },
  {
    id: "rigid-body-kinematics",
    course: "theoretical-mechanics",
    title: "刚体运动学",
    alias: ["刚体定点运动", "Euler 角"],
    description:
      "刚体运动学描述刚体位置和取向随时间的变化。平动、转动和角速度的关系必须分清。",
    textbookStyleSummary:
      "刚体任意运动可分解为质心平动和绕质心转动。使用 Euler 角时要固定转轴约定，否则角速度分量会产生不同表达式。",
    prerequisites: ["质点系"],
    related: ["刚体动力学", "非惯性系"],
    typicalProblems: ["求刚体上点的速度和加速度", "Euler 角与角速度关系", "无滑动滚动约束"],
    keyFormulas: ["\\boldsymbol v=\\boldsymbol V_O+\\boldsymbol\\omega\\times\\boldsymbol r", "\\dot{\\boldsymbol e}=\\boldsymbol\\omega\\times\\boldsymbol e"],
    commonMisunderstandings: ["把角速度和 Euler 角速度直接等同", "漏掉转动坐标系中的相对项", "无滑动条件方向写错"],
    studyOrder: 4,
    difficulty: "intermediate",
    tags: ["角速度", "Euler 角", "刚体"],
  },
  {
    id: "rigid-body",
    course: "theoretical-mechanics",
    title: "刚体动力学",
    alias: ["Euler 方程", "转动惯量"],
    description:
      "刚体动力学研究刚体受力矩后的转动规律。主轴、惯量张量和 Euler 方程是其基本工具。",
    textbookStyleSummary:
      "刚体转动的角动量一般不与角速度平行，只有在主轴坐标中才有简单分量关系。Euler 方程通常写在随体主轴系中。",
    prerequisites: ["刚体运动学", "质点系"],
    related: ["非惯性系", "Lagrange 方程"],
    typicalProblems: ["定轴转动", "刚体定点运动", "对称陀螺进动"],
    keyFormulas: ["\\boldsymbol L=\\mathbf I\\boldsymbol\\omega", "\\frac{d\\boldsymbol L}{dt}=\\boldsymbol M"],
    commonMisunderstandings: ["把标量转动惯量用于任意三维转动", "忽略随体系中的附加项", "没有区分空间轴和主轴"],
    studyOrder: 5,
    difficulty: "advanced",
    tags: ["惯量张量", "Euler 方程", "陀螺"],
  },
  {
    id: "non-inertial-frames",
    course: "theoretical-mechanics",
    title: "非惯性系",
    alias: ["转动参考系", "惯性力", "Coriolis 力"],
    description:
      "非惯性系中 Newton 方程需要加入惯性力。常见项包括平动惯性力、离心力、Coriolis 力和 Euler 力。",
    textbookStyleSummary:
      "惯性力不是相互作用力，而是由于参考系加速或转动引入的等效项。写方程前必须说明参考系的平动加速度和角速度。",
    prerequisites: ["质点力学", "刚体运动学"],
    related: ["刚体动力学", "Lagrange 方程"],
    typicalProblems: ["转盘上的质点运动", "地球自转导致的偏转", "相对运动加速度公式"],
    keyFormulas: [
      "\\boldsymbol a=\\boldsymbol a' +2\\boldsymbol\\Omega\\times\\boldsymbol v'+\\boldsymbol\\Omega\\times(\\boldsymbol\\Omega\\times\\boldsymbol r)+\\dot{\\boldsymbol\\Omega}\\times\\boldsymbol r",
    ],
    commonMisunderstandings: ["Coriolis 力方向判断错误", "把惯性力和真实约束力混为一谈", "漏掉角速度变化时的 Euler 力"],
    studyOrder: 6,
    difficulty: "intermediate",
    tags: ["惯性力", "Coriolis 力", "转动系"],
  },
  {
    id: "virtual-work",
    course: "theoretical-mechanics",
    title: "虚功原理",
    alias: ["虚位移", "d'Alembert 原理"],
    description:
      "虚功原理用满足约束的虚位移表达平衡或动力学条件。它适合处理理想约束系统。",
    textbookStyleSummary:
      "虚位移是在同一时刻满足约束的几何位移，不是实际运动微分。理想约束力对任意允许虚位移不做功，这是消去约束力的依据。",
    prerequisites: ["质点系", "约束"],
    related: ["Lagrange 方程", "Hamilton 原理"],
    typicalProblems: ["约束系统平衡条件", "用 d'Alembert 原理推导动力学方程", "广义力计算"],
    keyFormulas: ["\\sum_i \\boldsymbol F_i\\cdot\\delta\\boldsymbol r_i=0", "\\sum_i(\\boldsymbol F_i-m_i\\boldsymbol a_i)\\cdot\\delta\\boldsymbol r_i=0"],
    commonMisunderstandings: ["把虚位移当作真实位移", "没有检查约束是否理想", "广义力符号和坐标方向不一致"],
    studyOrder: 7,
    difficulty: "intermediate",
    tags: ["虚位移", "理想约束", "广义力"],
  },
  {
    id: "lagrange-equations",
    course: "theoretical-mechanics",
    title: "Lagrange 方程",
    alias: ["拉格朗日方程", "Lagrangian mechanics"],
    description:
      "Lagrange 方程用广义坐标描述约束系统的运动。它把动力学问题转化为动能、势能和广义力的关系。",
    textbookStyleSummary:
      "选择独立广义坐标后，约束被吸收到坐标表示中。保守系统通常由 $L=T-V$ 给出，非保守力通过广义力项进入方程。",
    prerequisites: ["虚功原理", "变分法基础"],
    related: ["Hamilton 原理", "Hamilton 正则方程", "小振动"],
    typicalProblems: ["单摆和复摆建模", "带约束的多自由度系统", "含非保守广义力的问题"],
    keyFormulas: ["\\frac{d}{dt}\\frac{\\partial L}{\\partial \\dot q_i}-\\frac{\\partial L}{\\partial q_i}=Q_i"],
    commonMisunderstandings: ["广义坐标未独立", "把广义力直接写成普通力", "势能依赖速度时仍套用简单形式"],
    studyOrder: 8,
    difficulty: "intermediate",
    tags: ["广义坐标", "广义力", "约束"],
  },
  {
    id: "hamilton-principle",
    course: "theoretical-mechanics",
    title: "Hamilton 原理",
    alias: ["最小作用量原理", "principle of stationary action"],
    description:
      "Hamilton 原理把真实运动表述为作用量的一阶变分为零。它是 Lagrange 方程的变分基础。",
    textbookStyleSummary:
      "作用量取驻值不一定是最小值。变分时端点时刻和端点坐标通常固定，边界项因此消失并得到 Euler-Lagrange 方程。",
    prerequisites: ["Lagrange 方程", "变分法基础"],
    related: ["Hamilton 正则方程", "量子力学路径积分思想"],
    typicalProblems: ["由作用量推导 Lagrange 方程", "判断广义坐标变换下的作用量形式", "处理带参数变分问题"],
    keyFormulas: ["S=\\int_{t_1}^{t_2}L(q,\\dot q,t)\\,dt", "\\delta S=0"],
    commonMisunderstandings: ["把驻值误称为必然最小", "忽略端点固定条件", "没有说明变分路径族"],
    studyOrder: 9,
    difficulty: "advanced",
    tags: ["作用量", "变分", "Euler-Lagrange"],
  },
  {
    id: "hamilton-equations",
    course: "theoretical-mechanics",
    title: "Hamilton 正则方程",
    alias: ["Hamilton 方程", "哈密顿方程"],
    description:
      "Hamilton 正则方程在相空间中描述系统演化。广义坐标和正则动量作为一组正则变量出现。",
    textbookStyleSummary:
      "从 Lagrange 表述到 Hamilton 表述需要 Legendre 变换。只有当速度可由动量反解时，Hamilton 量才能作为相空间函数使用。",
    prerequisites: ["Lagrange 方程", "Hamilton 原理"],
    related: ["Poisson 括号与正则变换", "系综理论"],
    typicalProblems: ["由 Lagrangian 构造 Hamiltonian", "求相轨道", "判断循环坐标和守恒量"],
    keyFormulas: ["H=\\sum_i p_i\\dot q_i-L", "\\dot q_i=\\frac{\\partial H}{\\partial p_i},\\quad \\dot p_i=-\\frac{\\partial H}{\\partial q_i}"],
    commonMisunderstandings: ["把广义动量等同于机械动量", "没有检查 Legendre 变换可逆性", "混淆能量和 Hamilton 量的适用条件"],
    studyOrder: 10,
    difficulty: "advanced",
    tags: ["相空间", "正则变量", "Legendre 变换"],
  },
  {
    id: "canonical-transformations",
    course: "theoretical-mechanics",
    title: "Poisson 括号与正则变换",
    alias: ["正则变换", "Poisson bracket"],
    description:
      "Poisson 括号刻画相空间函数随时间的变化和正则结构。正则变换保持 Hamilton 方程形式不变。",
    textbookStyleSummary:
      "正则变换的判据不是普通坐标变换是否可逆，而是是否保持辛结构或 Poisson 括号关系。生成函数是构造正则变换的常用方法。",
    prerequisites: ["Hamilton 正则方程"],
    related: ["量子对易关系", "系综理论"],
    typicalProblems: ["计算 Poisson 括号", "验证变换是否正则", "用生成函数求新旧变量关系"],
    keyFormulas: ["\\{f,g\\}=\\sum_i\\left(\\frac{\\partial f}{\\partial q_i}\\frac{\\partial g}{\\partial p_i}-\\frac{\\partial f}{\\partial p_i}\\frac{\\partial g}{\\partial q_i}\\right)"],
    commonMisunderstandings: ["把任意变量替换都当成正则变换", "符号约定前后不一致", "忽略生成函数类型"],
    studyOrder: 11,
    difficulty: "advanced",
    tags: ["Poisson 括号", "正则变换", "生成函数"],
  },
  {
    id: "small-oscillations",
    course: "theoretical-mechanics",
    title: "小振动",
    alias: ["简正模", "normal modes"],
    description:
      "小振动研究系统在稳定平衡位置附近的线性化运动。简正模把耦合自由度分解为独立振动。",
    textbookStyleSummary:
      "小振动近似要求保留动能和势能到二次项。频率由广义本征值问题决定，模态正交性依赖质量矩阵和力常数矩阵。",
    prerequisites: ["Lagrange 方程", "线性代数"],
    related: ["Sturm-Liouville 本征值问题", "声子和振动模式"],
    typicalProblems: ["双摆小振动", "耦合振子正常模", "稳定平衡判定"],
    keyFormulas: ["\\sum_j(V_{ij}-\\omega^2T_{ij})a_j=0"],
    commonMisunderstandings: ["在非平衡点附近直接线性化", "忽略质量矩阵", "把坐标耦合误认为物理耦合不可消去"],
    studyOrder: 12,
    difficulty: "advanced",
    tags: ["线性化", "简正模", "本征频率"],
  },
  {
    id: "electrostatics",
    course: "electrodynamics",
    title: "静电场",
    alias: ["电势", "Coulomb 定律", "Gauss 定理"],
    description:
      "静电场描述静止电荷产生的电场。真空中电场强度与电势满足 Poisson 方程或 Laplace 方程。",
    textbookStyleSummary:
      "静电问题中 $\\nabla\\times\\boldsymbol E=0$，因此可引入电势。介质中需区分电场强度 $\\boldsymbol E$、电位移矢量 $\\boldsymbol D$、自由电荷和束缚电荷。",
    prerequisites: [],
    related: ["静电边值问题", "镜像法", "多极展开"],
    typicalProblems: ["由电荷分布求电场和电势", "用 Gauss 定理求高对称场", "介质界面边界条件"],
    keyFormulas: ["\\nabla\\cdot\\boldsymbol E=\\rho/\\varepsilon_0", "\\boldsymbol E=-\\nabla\\varphi", "\\nabla^2\\varphi=-\\rho/\\varepsilon_0"],
    commonMisunderstandings: ["混淆 $\\boldsymbol E$ 与 $\\boldsymbol D$", "把自由电荷和总电荷混用", "忽略电势零点选择"],
    studyOrder: 1,
    difficulty: "basic",
    tags: ["电势", "Gauss 定理", "Poisson 方程"],
  },
  {
    id: "boundary-value-problems",
    course: "electrodynamics",
    title: "静电边值问题",
    alias: ["边值问题", "Laplace 方程", "Poisson 方程"],
    description:
      "静电边值问题是在给定导体、介质或边界条件下求电势。边界条件决定解的唯一性。",
    textbookStyleSummary:
      "导体表面是等势面，法向电位移跃变由自由面电荷给出。求解时应先确定区域、方程、边界条件，再选择镜像法、分离变量法或 Green 函数方法。",
    prerequisites: ["静电场", "定解问题"],
    related: ["镜像法", "分离变量法", "Green 函数"],
    typicalProblems: ["导体球外点电荷问题", "矩形或球形区域 Laplace 方程", "介质界面电势连续问题"],
    keyFormulas: ["\\varphi|_{S}=\\varphi_0", "\\left.\\varepsilon_1\\frac{\\partial\\varphi_1}{\\partial n}\\right|_S-\\left.\\varepsilon_2\\frac{\\partial\\varphi_2}{\\partial n}\\right|_S=-\\sigma_f"],
    commonMisunderstandings: ["只写 Laplace 方程而漏写边界条件", "导体边界与介质边界条件混淆", "未检查无穷远条件"],
    studyOrder: 2,
    difficulty: "intermediate",
    tags: ["边界条件", "唯一性定理", "导体"],
  },
  {
    id: "image-method",
    course: "electrodynamics",
    title: "镜像法",
    alias: ["电像法", "method of images"],
    description:
      "镜像法用虚设电荷替代导体边界的影响。它适用于具有较高对称性的静电边值问题。",
    textbookStyleSummary:
      "镜像电荷不在实际求解区域内，其作用是使边界条件得到满足。使用镜像法的依据是静电唯一性定理，而不是导体内真的存在镜像电荷。",
    prerequisites: ["静电边值问题"],
    related: ["Green 函数", "多极展开"],
    typicalProblems: ["点电荷与接地无限导体平面", "点电荷与接地导体球", "导体平面附近偶极子"],
    keyFormulas: ["\\varphi(\\boldsymbol r)=\\frac{1}{4\\pi\\varepsilon_0}\\sum_i\\frac{q_i}{|\\boldsymbol r-\\boldsymbol r_i|}"],
    commonMisunderstandings: ["把镜像电荷当作真实电荷", "在求解区域内放入镜像源", "不验证导体边界是否等势"],
    studyOrder: 3,
    difficulty: "intermediate",
    tags: ["唯一性定理", "导体边界", "等势面"],
  },
  {
    id: "multipole-expansion",
    course: "electrodynamics",
    title: "多极展开",
    alias: ["电多极矩", "multipole expansion"],
    description:
      "多极展开把远区电势表示为单极、偶极、四极等贡献。它用于描述局域电荷分布的远场行为。",
    textbookStyleSummary:
      "多极展开要求观察点到源区的距离大于源区尺度。低阶非零多极矩决定远区主导项，坐标原点选择会影响高阶矩表达。",
    prerequisites: ["静电场", "特殊函数"],
    related: ["电磁辐射", "球坐标边值问题"],
    typicalProblems: ["求电偶极子远场", "判断给定电荷分布的低阶多极矩", "球谐函数展开电势"],
    keyFormulas: ["\\varphi(\\boldsymbol r)=\\frac{1}{4\\pi\\varepsilon_0}\\left(\\frac{q}{r}+\\frac{\\boldsymbol p\\cdot\\hat{\\boldsymbol r}}{r^2}+\\cdots\\right)"],
    commonMisunderstandings: ["在近场使用远场展开", "忽略净电荷非零时单极项占主导", "混淆偶极矩方向和电场方向"],
    studyOrder: 4,
    difficulty: "advanced",
    tags: ["偶极矩", "远场", "球谐函数"],
  },
  {
    id: "magnetostatics",
    course: "electrodynamics",
    title: "静磁场",
    alias: ["稳恒电流磁场", "Biot-Savart 定律", "Ampere 定律"],
    description:
      "静磁场由稳恒电流产生。矢势常用于处理磁感应强度的旋度关系。",
    textbookStyleSummary:
      "静磁场满足 $\\nabla\\cdot\\boldsymbol B=0$。在介质中应区分磁感应强度 $\\boldsymbol B$ 和磁场强度 $\\boldsymbol H$，并说明自由电流与磁化电流。",
    prerequisites: ["静电场"],
    related: ["电磁场基本方程", "电磁势与规范变换"],
    typicalProblems: ["用 Biot-Savart 定律求磁场", "用 Ampere 环路定理求高对称场", "磁介质界面边界条件"],
    keyFormulas: ["\\nabla\\times\\boldsymbol B=\\mu_0\\boldsymbol j", "\\boldsymbol B=\\nabla\\times\\boldsymbol A"],
    commonMisunderstandings: ["混淆 $\\boldsymbol B$ 与 $\\boldsymbol H$", "把静磁场中的电流连续条件漏掉", "矢势规范未说明"],
    studyOrder: 5,
    difficulty: "basic",
    tags: ["磁感应强度", "矢势", "稳恒电流"],
  },
  {
    id: "maxwell-equations",
    course: "electrodynamics",
    title: "电磁场基本方程",
    alias: ["Maxwell 方程组", "麦克斯韦方程组"],
    description:
      "Maxwell 方程组描述电荷、电流与电磁场的关系。它统一了静态场和时变场。",
    textbookStyleSummary:
      "真空形式和介质形式应分开书写。介质形式中 $\\boldsymbol D$ 与自由电荷相关，$\\boldsymbol H$ 与自由电流相关；本构关系依赖材料模型。",
    prerequisites: ["静电场", "静磁场"],
    related: ["电磁波传播", "电磁势与规范变换", "电磁辐射"],
    typicalProblems: ["由 Maxwell 方程推出连续性方程", "判断边界条件", "从方程组导出波动方程"],
    keyFormulas: [
      "\\nabla\\cdot\\boldsymbol D=\\rho_f",
      "\\nabla\\times\\boldsymbol H=\\boldsymbol j_f+\\frac{\\partial\\boldsymbol D}{\\partial t}",
      "\\nabla\\times\\boldsymbol E=-\\frac{\\partial\\boldsymbol B}{\\partial t}",
    ],
    commonMisunderstandings: ["静态方程和时变方程混用", "自由源和束缚源混淆", "把本构关系误认为普遍方程"],
    studyOrder: 6,
    difficulty: "intermediate",
    tags: ["Maxwell 方程", "本构关系", "连续性方程"],
  },
  {
    id: "electromagnetic-waves",
    course: "electrodynamics",
    title: "电磁波传播",
    alias: ["平面电磁波", "Poynting 矢量"],
    description:
      "电磁波由时变电场和磁场相互激发形成。平面波模型用于描述均匀介质中的传播、偏振和能流。",
    textbookStyleSummary:
      "由无源 Maxwell 方程可推出波动方程。不同介质中的相速度、波阻抗和衰减由介电常数、磁导率和电导率决定。",
    prerequisites: ["电磁场基本方程"],
    related: ["波导与谐振腔", "电磁辐射"],
    typicalProblems: ["求平面波的电场磁场关系", "介质界面反射和折射", "计算 Poynting 矢量和能量密度"],
    keyFormulas: ["\\nabla^2\\boldsymbol E-\\mu\\varepsilon\\frac{\\partial^2\\boldsymbol E}{\\partial t^2}=0", "\\boldsymbol S=\\boldsymbol E\\times\\boldsymbol H"],
    commonMisunderstandings: ["把相速度和群速度混为一谈", "忽略介质导电性导致衰减", "偏振方向和传播方向关系判断错误"],
    studyOrder: 7,
    difficulty: "intermediate",
    tags: ["波动方程", "偏振", "能流"],
  },
  {
    id: "waveguides-cavities",
    course: "electrodynamics",
    title: "波导与谐振腔",
    alias: ["矩形波导", "TE/TM 模", "cavity"],
    description:
      "波导和谐振腔是有边界的电磁波问题。允许模式由导体边界条件和几何尺寸决定。",
    textbookStyleSummary:
      "理想导体边界上切向电场为零、法向磁感应强度为零。波导模式具有截止频率，低于截止频率不能传播。",
    prerequisites: ["电磁波传播", "定解问题"],
    related: ["分离变量法", "Sturm-Liouville 本征值问题"],
    typicalProblems: ["矩形波导 TE/TM 模", "求截止频率", "谐振腔本征频率"],
    keyFormulas: ["k_z^2=\\omega^2\\mu\\varepsilon-k_c^2", "\\omega_{mnp}=\\frac{1}{\\sqrt{\\mu\\varepsilon}}\\sqrt{\\left(\\frac{m\\pi}{a}\\right)^2+\\left(\\frac{n\\pi}{b}\\right)^2+\\left(\\frac{p\\pi}{d}\\right)^2}"],
    commonMisunderstandings: ["没有区分 TE、TM 和 TEM 模", "忽略截止条件", "边界条件写在错误的场分量上"],
    studyOrder: 8,
    difficulty: "advanced",
    tags: ["波导", "截止频率", "本征模"],
  },
  {
    id: "electromagnetic-potentials",
    course: "electrodynamics",
    title: "电磁势与规范变换",
    alias: ["电势与矢势", "Lorenz 规范", "Coulomb 规范"],
    description:
      "电磁势用标势和矢势表示电磁场。规范变换反映势的不唯一性，但不改变电场和磁场。",
    textbookStyleSummary:
      "由 $\\boldsymbol B=\\nabla\\times\\boldsymbol A$ 和 $\\boldsymbol E=-\\nabla\\varphi-\\partial\\boldsymbol A/\\partial t$ 引入势。Lorenz 规范保持相对论协变性，Coulomb 规范常用于分离横纵场。",
    prerequisites: ["电磁场基本方程"],
    related: ["电磁辐射", "狭义相对论电动力学"],
    typicalProblems: ["验证规范变换不改变场", "在 Lorenz 规范下求延迟势", "比较 Coulomb 规范和 Lorenz 规范"],
    keyFormulas: ["\\boldsymbol A' =\\boldsymbol A+\\nabla\\chi", "\\varphi'=\\varphi-\\frac{\\partial\\chi}{\\partial t}", "\\nabla\\cdot\\boldsymbol A+\\frac{1}{c^2}\\frac{\\partial\\varphi}{\\partial t}=0"],
    commonMisunderstandings: ["把势的不唯一性误解为场不唯一", "把 Lorenz 规范写成 Lorentz 变换", "Coulomb 规范下误认为相互作用瞬时传播"],
    studyOrder: 9,
    difficulty: "advanced",
    tags: ["矢势", "规范", "延迟势"],
  },
  {
    id: "radiation-theory",
    course: "electrodynamics",
    title: "电磁辐射",
    alias: ["偶极辐射", "辐射场", "Larmor 公式"],
    description:
      "电磁辐射研究加速电荷或时变电流在远区产生的电磁波。偶极辐射是低频小源的基本近似。",
    textbookStyleSummary:
      "辐射场是远区按 $1/r$ 衰减的横向场，能流在远区有有限总功率。近区感应场和远区辐射场应分开讨论。",
    prerequisites: ["电磁势与规范变换", "电磁波传播", "多极展开"],
    related: ["狭义相对论电动力学"],
    typicalProblems: ["电偶极辐射角分布", "计算辐射功率", "区分近场和远场项"],
    keyFormulas: ["P=\\frac{\\mu_0\\ddot{\\boldsymbol p}^{\,2}}{6\\pi c}", "\\boldsymbol S=\\boldsymbol E_{\\rm rad}\\times\\boldsymbol H_{\\rm rad}"],
    commonMisunderstandings: ["把近场项当作辐射功率来源", "忽略远区近似条件", "角分布和偏振方向混淆"],
    studyOrder: 10,
    difficulty: "advanced",
    tags: ["偶极辐射", "远区场", "辐射功率"],
  },
  {
    id: "relativistic-electrodynamics",
    course: "electrodynamics",
    title: "狭义相对论电动力学",
    alias: ["四维形式", "电磁场张量", "Lorentz 变换"],
    description:
      "狭义相对论电动力学用四维矢量和张量统一表示电磁场。电场和磁场在不同惯性系中相互混合。",
    textbookStyleSummary:
      "电磁场张量和四维电流使 Maxwell 方程具有协变形式。判断场量变换时应区分三维矢量变换和四维张量变换。",
    prerequisites: ["电磁场基本方程", "线性代数"],
    related: ["电磁势与规范变换", "量子力学中的相对论修正"],
    typicalProblems: ["电磁场 Lorentz 变换", "写出协变 Maxwell 方程", "判断电磁场不变量"],
    keyFormulas: ["\\partial_\\mu F^{\\mu\\nu}=\\mu_0 j^\\nu", "F_{\\mu\\nu}F^{\\mu\\nu}=2(B^2-E^2/c^2)"],
    commonMisunderstandings: ["把 Lorentz 规范和 Lorentz 变换混淆", "四维指标升降号约定不一致", "误以为电场或磁场单独具有绝对意义"],
    studyOrder: 11,
    difficulty: "advanced",
    tags: ["协变形式", "场张量", "四维矢量"],
  },
  {
    id: "wavefunction-state-vector",
    course: "quantum-mechanics",
    title: "波函数与 Schrödinger 方程",
    alias: ["波函数", "态矢量", "Schrödinger 方程"],
    description:
      "波函数是态矢量在坐标表象中的表示。Schrödinger 方程给出量子态随时间的演化。",
    textbookStyleSummary:
      "态矢量是抽象 Hilbert 空间中的元素，波函数是某一表象下的坐标函数。概率解释要求波函数平方可积并归一化。",
    prerequisites: ["线性代数", "复变函数基础"],
    related: ["一维定态问题", "力学量算符", "表象理论"],
    typicalProblems: ["归一化波函数", "由初态求时间演化", "判断概率流密度"],
    keyFormulas: ["i\\hbar\\frac{\\partial}{\\partial t}\\psi=\\hat H\\psi", "\\int |\\psi(\\boldsymbol r,t)|^2\\,d\\tau=1"],
    commonMisunderstandings: ["把波函数本身当作概率", "混淆态矢量和坐标表象波函数", "忽略整体相位不影响物理状态"],
    studyOrder: 1,
    difficulty: "basic",
    tags: ["态矢量", "波函数", "概率解释"],
  },
  {
    id: "schrodinger-equation",
    course: "quantum-mechanics",
    title: "定态 Schrödinger 方程",
    alias: ["定态方程", "能量本征值问题"],
    description:
      "定态 Schrödinger 方程是 Hamilton 算符的本征值问题。它给出能量本征值和对应本征态。",
    textbookStyleSummary:
      "若 Hamilton 量不显含时间，可分离出时间因子，空间部分满足能量本征方程。边界条件和归一化条件决定允许能级。",
    prerequisites: ["波函数与 Schrödinger 方程"],
    related: ["一维定态问题", "中心力场", "力学量算符"],
    typicalProblems: ["判断束缚态和散射态", "求能量本征值", "检查波函数连续性和归一化"],
    keyFormulas: ["\\hat H\\psi_n=E_n\\psi_n", "\\Psi_n(\\boldsymbol r,t)=\\psi_n(\\boldsymbol r)e^{-iE_nt/\\hbar}"],
    commonMisunderstandings: ["把所有态都当作定态", "忽略势能间断处导数条件", "简并能级的本征态选择不唯一"],
    studyOrder: 2,
    difficulty: "basic",
    tags: ["定态", "能量本征值", "归一化"],
  },
  {
    id: "one-dimensional-stationary",
    course: "quantum-mechanics",
    title: "一维定态问题",
    alias: ["势阱", "势垒", "一维谐振子"],
    description:
      "一维定态问题训练边界条件、连续性条件和能级量子化。典型模型包括势阱、势垒和谐振子。",
    textbookStyleSummary:
      "求解时先分区写定态方程，再按波函数连续性、导数连续性或势垒无穷高边界条件确定系数。束缚态要求平方可积，散射态使用流密度归一化或入射反射透射系数。",
    prerequisites: ["定态 Schrödinger 方程"],
    related: ["WKB 近似", "散射理论"],
    typicalProblems: ["一维无限深势阱", "有限深势阱束缚态", "势垒隧穿与透射系数", "一维线性谐振子"],
    keyFormulas: ["-\\frac{\\hbar^2}{2m}\\frac{d^2\\psi}{dx^2}+V(x)\\psi=E\\psi", "E_n=\\hbar\\omega\\left(n+\\frac12\\right)"],
    commonMisunderstandings: ["势能无穷大边界和有限跃变边界条件混用", "反射系数与振幅系数混淆", "没有区分束缚态和散射态归一化"],
    studyOrder: 3,
    difficulty: "intermediate",
    tags: ["势阱", "隧穿", "谐振子"],
  },
  {
    id: "observables-operators",
    course: "quantum-mechanics",
    title: "力学量算符",
    alias: ["厄米算符", "可观测量", "observable"],
    description:
      "量子力学中可观测量由厄米算符表示。测量结果与算符本征值及态在本征态上的展开有关。",
    textbookStyleSummary:
      "厄米性保证本征值为实数，并使不同本征值对应的本征态正交。算符的定义域、边界条件和对易关系会影响可观测量的物理含义。",
    prerequisites: ["波函数与 Schrödinger 方程", "线性代数"],
    related: ["本征态与测量", "表象理论", "角动量"],
    typicalProblems: ["验证算符厄米性", "求平均值和不确定度", "计算对易关系"],
    keyFormulas: ["\\langle A\\rangle=\\langle\\psi|\\hat A|\\psi\\rangle", "[\\hat x,\\hat p_x]=i\\hbar"],
    commonMisunderstandings: ["把算符形式和表象无关性质混淆", "忽略算符定义域", "误认为任意两个力学量都有共同本征态"],
    studyOrder: 4,
    difficulty: "intermediate",
    tags: ["厄米算符", "平均值", "对易关系"],
  },
  {
    id: "measurement-eigenstates",
    course: "quantum-mechanics",
    title: "本征态与测量",
    alias: ["测量假设", "本征值", "projection"],
    description:
      "测量理论把可观测量的可能结果与算符本征值联系起来。测量概率由态在本征子空间上的投影决定。",
    textbookStyleSummary:
      "非简并本征值对应一个本征态，简并本征值对应本征子空间。测量后态的变化取决于测量类型和是否区分简并子空间内的态。",
    prerequisites: ["力学量算符"],
    related: ["表象理论", "角动量"],
    typicalProblems: ["按本征态展开初态", "求测量概率", "处理简并本征值测量"],
    keyFormulas: ["P(a_n)=|\\langle a_n|\\psi\\rangle|^2", "\\hat A|a_n\\rangle=a_n|a_n\\rangle"],
    commonMisunderstandings: ["把本征态展开系数和概率混淆", "忽略简并本征子空间", "连续谱归一化使用错误"],
    studyOrder: 5,
    difficulty: "intermediate",
    tags: ["本征态", "测量", "简并"],
  },
  {
    id: "representations",
    course: "quantum-mechanics",
    title: "表象理论",
    alias: ["坐标表象", "动量表象", "矩阵表象"],
    description:
      "表象是对同一量子态和算符的不同基底表示。物理结论不依赖表象选择。",
    textbookStyleSummary:
      "态矢量在给定完备基下的分量就是该表象中的波函数或列矢量。算符在表象中表示为矩阵或微分算符，表象变换由幺正变换实现。",
    prerequisites: ["本征态与测量", "线性代数"],
    related: ["角动量", "自旋"],
    typicalProblems: ["坐标表象和动量表象互变", "构造算符矩阵元", "用完备性关系插入单位算符"],
    keyFormulas: ["\\psi(x)=\\langle x|\\psi\\rangle", "\\sum_n |n\\rangle\\langle n|=1"],
    commonMisunderstandings: ["把表象改变误认为物理态改变", "忽略连续基的 delta 归一化", "矩阵元上下标顺序写反"],
    studyOrder: 6,
    difficulty: "intermediate",
    tags: ["基底", "幺正变换", "完备性"],
  },
  {
    id: "central-potential",
    course: "quantum-mechanics",
    title: "中心力场",
    alias: ["氢原子", "球对称势"],
    description:
      "中心力场中势能只依赖径向距离，角向部分由球谐函数描述。它是角动量理论的重要应用。",
    textbookStyleSummary:
      "中心势具有旋转对称性，Hamilton 算符与 $\\hat L^2$ 和 $\\hat L_z$ 对易。径向方程包含离心势项，边界条件决定能级。",
    prerequisites: ["表象理论", "角动量"],
    related: ["特殊函数", "定态微扰论"],
    typicalProblems: ["氢原子能级和波函数", "球方势阱", "径向方程边界条件"],
    keyFormulas: ["\\psi(r,\\theta,\\phi)=R_{nl}(r)Y_l^m(\\theta,\\phi)", "V_{\\rm eff}(r)=V(r)+\\frac{\\hbar^2l(l+1)}{2mr^2}"],
    commonMisunderstandings: ["把径向函数和约化径向函数边界条件混淆", "忽略角动量量子数限制", "把简并来源全部归因于偶然性"],
    studyOrder: 7,
    difficulty: "advanced",
    tags: ["球谐函数", "氢原子", "径向方程"],
  },
  {
    id: "angular-momentum",
    course: "quantum-mechanics",
    title: "角动量",
    alias: ["轨道角动量", "升降算符", "angular momentum"],
    description:
      "角动量算符满足特定对易关系，其本征态由量子数 $l,m$ 标记。升降算符用于构造磁量子数不同的态。",
    textbookStyleSummary:
      "角动量代数比具体坐标表示更基本。$\\hat L^2$ 与某一分量可同时对角化，但不同分量之间不可同时确定。",
    prerequisites: ["力学量算符", "表象理论"],
    related: ["中心力场", "自旋", "角动量耦合"],
    typicalProblems: ["计算升降算符作用", "求角动量本征值", "角动量耦合和 Clebsch-Gordan 系数"],
    keyFormulas: ["[\\hat L_i,\\hat L_j]=i\\hbar\\epsilon_{ijk}\\hat L_k", "\\hat L_{\\pm}|l m\\rangle=\\hbar\\sqrt{l(l+1)-m(m\\pm1)}|l,m\\pm1\\rangle"],
    commonMisunderstandings: ["认为三个角动量分量可同时精确确定", "升降算符归一化因子漏写", "把轨道角动量和自旋完全等同"],
    studyOrder: 8,
    difficulty: "advanced",
    tags: ["对易关系", "升降算符", "角动量耦合"],
  },
  {
    id: "spin",
    course: "quantum-mechanics",
    title: "自旋",
    alias: ["Pauli 矩阵", "spin"],
    description:
      "自旋是粒子的内禀角动量，没有经典轨道图像。自旋 $1/2$ 系统常用 Pauli 矩阵表示。",
    textbookStyleSummary:
      "自旋态属于有限维 Hilbert 空间。自旋测量沿不同方向对应不同算符，态在不同方向本征基之间由幺正变换联系。",
    prerequisites: ["角动量", "表象理论"],
    related: ["全同粒子", "定态微扰论"],
    typicalProblems: ["Stern-Gerlach 测量概率", "Pauli 矩阵计算", "自旋在磁场中的进动"],
    keyFormulas: ["\\hat{\\boldsymbol S}=\\frac{\\hbar}{2}\\boldsymbol\\sigma", "[\\hat S_i,\\hat S_j]=i\\hbar\\epsilon_{ijk}\\hat S_k"],
    commonMisunderstandings: ["把自旋理解为粒子实际自转", "忽略测量方向改变基底", "Pauli 矩阵和自旋算符少乘 \\hbar/2"],
    studyOrder: 9,
    difficulty: "advanced",
    tags: ["Pauli 矩阵", "内禀角动量", "二能级系统"],
  },
  {
    id: "identical-particles",
    course: "quantum-mechanics",
    title: "全同粒子",
    alias: ["对称化原理", "Pauli 不相容原理"],
    description:
      "全同粒子不可通过轨迹或标签区分。多粒子波函数必须满足交换对称性要求。",
    textbookStyleSummary:
      "玻色子对应对称波函数，费米子对应反对称波函数。Pauli 不相容原理来自费米子反对称性，不是额外的经典排斥力。",
    prerequisites: ["自旋", "表象理论"],
    related: ["量子统计", "Fermi-Dirac 分布", "Bose-Einstein 分布"],
    typicalProblems: ["构造两粒子对称或反对称态", "判断允许量子态", "交换简并和自旋态耦合"],
    keyFormulas: ["\\Psi(1,2)=\\pm\\Psi(2,1)"],
    commonMisunderstandings: ["把全同粒子仍按经典标签区分", "对称空间部分和自旋部分未整体判断", "把 Pauli 原理误用于玻色子"],
    studyOrder: 10,
    difficulty: "advanced",
    tags: ["交换对称性", "玻色子", "费米子"],
  },
  {
    id: "perturbation-theory",
    course: "quantum-mechanics",
    title: "定态微扰论",
    alias: ["非简并微扰", "简并微扰"],
    description:
      "定态微扰论用于 Hamilton 量可写成可解部分加小修正的情形。简并和非简并情形处理方法不同。",
    textbookStyleSummary:
      "非简并微扰可直接按微扰展开修正能量和态。简并微扰必须先在简并子空间中对角化微扰矩阵，否则一级修正不确定。",
    prerequisites: ["一维定态问题", "本征态与测量"],
    related: ["自旋", "中心力场", "量子变分法"],
    typicalProblems: ["一阶能量修正", "二阶能量修正", "简并能级劈裂", "Stark 或 Zeeman 效应"],
    keyFormulas: ["E_n^{(1)}=\\langle n^{(0)}|\\hat H'|n^{(0)}\\rangle", "E_n^{(2)}=\\sum_{m\\ne n}\\frac{|\\langle m^{(0)}|\\hat H'|n^{(0)}\\rangle|^2}{E_n^{(0)}-E_m^{(0)}}"],
    commonMisunderstandings: ["简并问题直接套非简并公式", "忽略选择定则导致矩阵元为零", "微扰强度与能级间隔关系未检查"],
    studyOrder: 11,
    difficulty: "advanced",
    tags: ["近似方法", "能级修正", "简并"],
  },
  {
    id: "quantum-variational-method",
    course: "quantum-mechanics",
    title: "变分法与 WKB 近似",
    alias: ["量子变分法", "WKB approximation"],
    description:
      "变分法用试探波函数估计基态能量，WKB 近似用于势能缓慢变化的一维问题。二者都是常用近似方法。",
    textbookStyleSummary:
      "变分法给出的能量期望值不低于真实基态能量。WKB 近似要求 de Broglie 波长随位置变化缓慢，并需在转折点处使用连接公式。",
    prerequisites: ["一维定态问题", "定态微扰论"],
    related: ["散射理论", "中心力场"],
    typicalProblems: ["用试探函数估算基态能量", "WKB 量子化条件", "势垒穿透概率估算"],
    keyFormulas: ["E_0\\le \\frac{\\langle\\psi|\\hat H|\\psi\\rangle}{\\langle\\psi|\\psi\\rangle}", "\\int_{x_1}^{x_2}p(x)\\,dx=\\left(n+\\frac12\\right)\\pi\\hbar"],
    commonMisunderstandings: ["变分结果误认为精确能量", "试探函数不满足边界条件", "在转折点附近直接使用普通 WKB 解"],
    studyOrder: 12,
    difficulty: "advanced",
    tags: ["变分法", "WKB", "近似方法"],
  },
  {
    id: "scattering-theory",
    course: "quantum-mechanics",
    title: "散射理论",
    alias: ["散射振幅", "Born 近似", "partial waves"],
    description:
      "散射理论研究入射粒子受势场作用后的角分布。散射振幅和微分截面是主要物理量。",
    textbookStyleSummary:
      "散射态的边界条件包含入射平面波和出射球面波。Born 近似适用于势能较弱或入射能较高的情况，低能散射常用分波法。",
    prerequisites: ["一维定态问题", "Green 函数"],
    related: ["中心力场", "电磁辐射"],
    typicalProblems: ["求散射振幅", "计算微分截面", "Born 近似和分波法"],
    keyFormulas: ["\\psi(\\boldsymbol r)\\sim e^{ikz}+f(\\theta,\\phi)\\frac{e^{ikr}}{r}", "\\frac{d\\sigma}{d\\Omega}=|f(\\theta,\\phi)|^2"],
    commonMisunderstandings: ["把散射态按束缚态归一化", "忽略远区渐近条件", "Born 近似适用性不检查"],
    studyOrder: 13,
    difficulty: "advanced",
    tags: ["散射振幅", "截面", "Born 近似"],
  },
  {
    id: "thermodynamic-laws",
    course: "thermo-stat",
    title: "热力学基本规律",
    alias: ["热力学第一定律", "热力学第二定律", "熵"],
    description:
      "热力学基本规律描述宏观平衡态之间的能量和熵关系。它不依赖物质微观模型。",
    textbookStyleSummary:
      "热力学状态由少数宏观变量描述，过程量如热量和功依赖路径。熵是状态函数，第二定律给出不可逆过程方向。",
    prerequisites: [],
    related: ["热力学势与自然变量", "统计物理基本假设"],
    typicalProblems: ["可逆过程功和热量计算", "熵变计算", "热机效率和 Clausius 不等式"],
    keyFormulas: ["dU=\\delta Q+\\delta W", "dS\\ge \\frac{\\delta Q}{T}"],
    commonMisunderstandings: ["把热量当作状态函数", "熵增原理适用系统边界不清", "可逆和准静态混淆"],
    studyOrder: 1,
    difficulty: "basic",
    tags: ["内能", "熵", "可逆过程"],
  },
  {
    id: "uniform-substances",
    course: "thermo-stat",
    title: "均匀物质热力学性质",
    alias: ["状态方程", "热容", "压缩系数"],
    description:
      "均匀物质的热力学性质通过状态方程和响应系数描述。常见变量包括压强、体积、温度和熵。",
    textbookStyleSummary:
      "状态方程给出状态变量之间的约束，热容、膨胀系数和压缩系数描述平衡态附近的响应。推导时要固定自然变量。",
    prerequisites: ["热力学基本规律"],
    related: ["Maxwell 关系", "相平衡"],
    typicalProblems: ["热容关系推导", "用状态方程计算过程量", "响应系数恒等式"],
    keyFormulas: ["C_V=T\\left(\\frac{\\partial S}{\\partial T}\\right)_V", "\\alpha=\\frac1V\\left(\\frac{\\partial V}{\\partial T}\\right)_p"],
    commonMisunderstandings: ["偏导固定变量写错", "热容下标含义不清", "把理想气体结论用于任意物质"],
    studyOrder: 2,
    difficulty: "basic",
    tags: ["状态方程", "热容", "响应系数"],
  },
  {
    id: "thermodynamic-potentials",
    course: "thermo-stat",
    title: "热力学势与自然变量",
    alias: ["Helmholtz 自由能", "Gibbs 自由能", "Legendre 变换"],
    description:
      "热力学势通过 Legendre 变换适配不同控制变量。自然变量决定势函数的微分形式和判据。",
    textbookStyleSummary:
      "内能、焓、Helmholtz 自由能和 Gibbs 自由能分别适用于不同约束条件。判断平衡和稳定性时必须使用与实验控制条件相匹配的热力学势。",
    prerequisites: ["热力学基本规律"],
    related: ["Maxwell 关系", "相平衡", "正则系综"],
    typicalProblems: ["写出热力学势微分式", "判断自然变量", "用自由能判定平衡方向"],
    keyFormulas: ["dU=TdS-pdV+\\mu dN", "F=U-TS", "G=U-TS+pV"],
    commonMisunderstandings: ["自然变量和独立变量混淆", "Legendre 变换符号写错", "不同控制条件下误用热力学势"],
    studyOrder: 3,
    difficulty: "intermediate",
    tags: ["自由能", "自然变量", "Legendre 变换"],
  },
  {
    id: "maxwell-relations",
    course: "thermo-stat",
    title: "Maxwell 关系",
    alias: ["热力学偏导关系", "Maxwell relations"],
    description:
      "Maxwell 关系来自热力学势二阶混合偏导相等。它用于把难测量偏导转化为可测量响应。",
    textbookStyleSummary:
      "每一组 Maxwell 关系都对应某个热力学势的自然变量。使用时应从微分式出发，避免死记符号。",
    prerequisites: ["热力学势与自然变量"],
    related: ["均匀物质热力学性质", "相平衡"],
    typicalProblems: ["由热力学势推 Maxwell 关系", "推导热容差公式", "计算熵随体积或压强变化"],
    keyFormulas: ["\\left(\\frac{\\partial T}{\\partial V}\\right)_S=-\\left(\\frac{\\partial p}{\\partial S}\\right)_V", "\\left(\\frac{\\partial S}{\\partial V}\\right)_T=\\left(\\frac{\\partial p}{\\partial T}\\right)_V"],
    commonMisunderstandings: ["偏导下标漏写", "关系式符号由记忆导致错误", "未确认势函数自然变量"],
    studyOrder: 4,
    difficulty: "intermediate",
    tags: ["偏导", "热力学势", "响应函数"],
  },
  {
    id: "phase-equilibrium",
    course: "thermo-stat",
    title: "相平衡",
    alias: ["相变", "化学势", "Clapeyron 方程"],
    description:
      "相平衡描述多相共存时温度、压强和化学势的条件。化学势相等是物质交换平衡的判据。",
    textbookStyleSummary:
      "相平衡条件来自熵极大或自由能极小。一级相变中相变潜热导致相界斜率满足 Clapeyron 方程。",
    prerequisites: ["热力学势与自然变量", "Maxwell 关系"],
    related: ["巨正则系综", "涨落理论"],
    typicalProblems: ["两相共存条件", "相图斜率计算", "Gibbs 相律应用"],
    keyFormulas: ["\\mu_\\alpha(T,p)=\\mu_\\beta(T,p)", "\\frac{dp}{dT}=\\frac{L}{T\\Delta v}"],
    commonMisunderstandings: ["把相变点和临界点混淆", "化学势与化学反应势未区分", "忽略相律中独立变量数"],
    studyOrder: 5,
    difficulty: "intermediate",
    tags: ["化学势", "相图", "Clapeyron 方程"],
  },
  {
    id: "statistical-postulates",
    course: "thermo-stat",
    title: "统计物理基本假设",
    alias: ["等概率原理", "Liouville 定理", "微观态"],
    description:
      "统计物理用大量微观态的统计规律解释宏观热力学。基本假设连接微观态数和熵。",
    textbookStyleSummary:
      "孤立平衡系统在可及微观态上等概率分布。宏观量是相空间或量子态上的统计平均，热力学极限使涨落相对变小。",
    prerequisites: ["热力学基本规律", "Hamilton 正则方程"],
    related: ["微正则系综", "正则系综", "涨落理论"],
    typicalProblems: ["计算微观态数", "由态数求熵", "理解系综平均与时间平均关系"],
    keyFormulas: ["S=k_B\\ln\\Omega", "\\langle A\\rangle=\\sum_i \\rho_i A_i"],
    commonMisunderstandings: ["把最概然态当作唯一微观态", "忽略宏观约束决定可及态", "混淆微观态和宏观态"],
    studyOrder: 6,
    difficulty: "intermediate",
    tags: ["微观态", "熵", "系综平均"],
  },
  {
    id: "microcanonical-ensemble",
    course: "thermo-stat",
    title: "微正则系综",
    alias: ["孤立系统系综", "microcanonical ensemble"],
    description:
      "微正则系综描述能量、体积和粒子数固定的孤立系统。所有可及微观态等概率。",
    textbookStyleSummary:
      "微正则分布是正则分布和巨正则分布的基础。温度、压强和化学势可由熵对自然变量的偏导定义。",
    prerequisites: ["统计物理基本假设"],
    related: ["正则系综", "巨正则系综"],
    typicalProblems: ["理想气体微观态数估算", "由熵定义温度", "判断能量壳层上的等概率分布"],
    keyFormulas: ["\\rho_i=\\frac1\\Omega", "\\frac1T=\\left(\\frac{\\partial S}{\\partial U}\\right)_{V,N}"],
    commonMisunderstandings: ["把固定能量理解为单一能级", "忽略能量壳宽度", "与正则系综的能量涨落混淆"],
    studyOrder: 7,
    difficulty: "intermediate",
    tags: ["孤立系统", "等概率", "态数"],
  },
  {
    id: "canonical-ensemble",
    course: "thermo-stat",
    title: "正则系综",
    alias: ["Gibbs 分布", "canonical ensemble"],
    description:
      "正则系综描述与热源接触、温度固定的系统。系统能量可以涨落，但粒子数和体积固定。",
    textbookStyleSummary:
      "正则分布由小系统与大热源组成的孤立系统推出。配分函数包含全部平衡热力学信息，Helmholtz 自由能由其决定。",
    prerequisites: ["微正则系综"],
    related: ["Boltzmann 分布与 Gibbs 分布", "经典统计", "量子统计"],
    typicalProblems: ["由配分函数求内能和热容", "二能级系统", "谐振子正则统计"],
    keyFormulas: ["\\rho_i=\\frac{e^{-\\beta E_i}}{Z}", "Z=\\sum_i e^{-\\beta E_i}", "F=-k_BT\\ln Z"],
    commonMisunderstandings: ["把温度固定理解为能量固定", "配分函数少计简并度", "对可分辨和不可分辨粒子处理混淆"],
    studyOrder: 8,
    difficulty: "intermediate",
    tags: ["配分函数", "Gibbs 分布", "自由能"],
  },
  {
    id: "grand-canonical-ensemble",
    course: "thermo-stat",
    title: "巨正则系综",
    alias: ["grand canonical ensemble", "巨配分函数"],
    description:
      "巨正则系综描述温度、体积和化学势固定的开放系统。能量和粒子数都允许涨落。",
    textbookStyleSummary:
      "巨正则分布适合处理粒子数可变系统和量子气体。巨热力学势与压强、体积直接相关。",
    prerequisites: ["正则系综", "化学势"],
    related: ["量子统计", "Bose-Einstein 分布", "Fermi-Dirac 分布"],
    typicalProblems: ["由巨配分函数求平均粒子数", "推导量子气体占据数", "计算粒子数涨落"],
    keyFormulas: ["\\rho_{iN}=\\frac{e^{-\\beta(E_{iN}-\\mu N)}}{\\Xi}", "\\Omega_G=-k_BT\\ln\\Xi=-pV"],
    commonMisunderstandings: ["化学势符号写反", "平均粒子数和瞬时粒子数混淆", "巨配分函数与正则配分函数混用"],
    studyOrder: 9,
    difficulty: "advanced",
    tags: ["化学势", "巨配分函数", "开放系统"],
  },
  {
    id: "classical-statistics",
    course: "thermo-stat",
    title: "经典统计",
    alias: ["Maxwell-Boltzmann 统计", "经典理想气体"],
    description:
      "经典统计在相空间中描述可近似为经典粒子的系统。理想气体是其基本应用。",
    textbookStyleSummary:
      "经典极限要求热 de Broglie 波长远小于粒子平均间距。对全同粒子应加入 $1/N!$ 因子以避免 Gibbs 佯谬。",
    prerequisites: ["正则系综"],
    related: ["Boltzmann 分布与 Gibbs 分布", "量子统计"],
    typicalProblems: ["经典理想气体配分函数", "Maxwell 速率分布", "能均分定理应用"],
    keyFormulas: ["Z_N=\\frac{1}{N!h^{3N}}\\int e^{-\\beta H(p,q)}\\,d^{3N}p\\,d^{3N}q", "\\langle \\varepsilon\\rangle=\\frac12 k_BT\\text{ 每个二次型自由度}"],
    commonMisunderstandings: ["忘记不可分辨粒子的 $1/N!$", "在低温高密度仍使用经典统计", "相空间积分量纲处理错误"],
    studyOrder: 10,
    difficulty: "intermediate",
    tags: ["相空间", "理想气体", "能均分"],
  },
  {
    id: "boltzmann-gibbs-distribution",
    course: "thermo-stat",
    title: "Boltzmann 分布与 Gibbs 分布",
    alias: ["Boltzmann 因子", "Gibbs distribution"],
    description:
      "Boltzmann 因子给出能量较高态的相对权重。Gibbs 分布是正则系综中的平衡概率分布。",
    textbookStyleSummary:
      "Boltzmann 分布常指单粒子能级占据的经典极限，Gibbs 分布指系统微观态的正则分布。二者相关但层级不同。",
    prerequisites: ["正则系综"],
    related: ["经典统计", "量子统计"],
    typicalProblems: ["计算能级占据比", "由 Gibbs 分布求平均能量", "推导 Maxwell 速度分布"],
    keyFormulas: ["\\frac{n_i}{n_j}=e^{-\\beta(\\varepsilon_i-\\varepsilon_j)}", "\\rho_i=\\frac{e^{-\\beta E_i}}{Z}"],
    commonMisunderstandings: ["把单粒子分布和系统微观态分布混为一谈", "忽略简并度因子", "温度趋近零和无穷大极限判断错误"],
    studyOrder: 11,
    difficulty: "intermediate",
    tags: ["Boltzmann 因子", "Gibbs 分布", "占据数"],
  },
  {
    id: "quantum-statistics",
    course: "thermo-stat",
    title: "量子统计",
    alias: ["玻色统计", "费米统计", "占据数表象"],
    description:
      "量子统计处理不可分辨粒子系统。粒子的交换对称性决定可允许的占据数分布。",
    textbookStyleSummary:
      "玻色子允许同一单粒子态有任意占据数，费米子每个态最多占据一个粒子。量子统计在低温或高密度时不能用经典统计替代。",
    prerequisites: ["巨正则系综", "全同粒子"],
    related: ["Bose-Einstein 分布", "Fermi-Dirac 分布"],
    typicalProblems: ["由巨正则系综推平均占据数", "判断经典极限", "量子理想气体热力学量"],
    keyFormulas: ["\\bar n_i=\\frac1{e^{\\beta(\\varepsilon_i-\\mu)}\\mp1}"],
    commonMisunderstandings: ["把玻色和费米分母符号写反", "忽略化学势限制", "在经典极限仍保留量子修正主导项"],
    studyOrder: 12,
    difficulty: "advanced",
    tags: ["不可分辨性", "占据数", "量子气体"],
  },
  {
    id: "bose-einstein",
    course: "thermo-stat",
    title: "Bose-Einstein 分布",
    alias: ["玻色-爱因斯坦分布", "BE distribution"],
    description:
      "Bose-Einstein 分布描述玻色子的平均占据数。低温下可出现基态宏观占据。",
    textbookStyleSummary:
      "玻色子的化学势不超过基态能量。凝聚现象来自激发态可容纳粒子数有限，而不是粒子间吸引的必然结果。",
    prerequisites: ["量子统计"],
    related: ["全同粒子", "正则系综"],
    typicalProblems: ["求玻色气体平均占据数", "判断凝聚条件", "计算低温热容趋势"],
    keyFormulas: ["\\bar n_i=\\frac1{e^{\\beta(\\varepsilon_i-\\mu)}-1}"],
    commonMisunderstandings: ["化学势取值范围判断错误", "把凝聚理解为所有粒子都在基态", "忽略态密度维度影响"],
    studyOrder: 13,
    difficulty: "advanced",
    tags: ["玻色子", "凝聚", "平均占据数"],
  },
  {
    id: "fermi-dirac",
    course: "thermo-stat",
    title: "Fermi-Dirac 分布",
    alias: ["费米-狄拉克分布", "FD distribution"],
    description:
      "Fermi-Dirac 分布描述费米子的平均占据数。低温下 Fermi 面附近的激发决定许多热性质。",
    textbookStyleSummary:
      "每个单粒子态最多被一个同自旋费米子占据。零温极限下能量低于 Fermi 能的态被填满，高于 Fermi 能的态为空。",
    prerequisites: ["量子统计"],
    related: ["全同粒子", "经典统计"],
    typicalProblems: ["求 Fermi 能", "电子气低温热容", "判断简并费米气体极限"],
    keyFormulas: ["\\bar n_i=\\frac1{e^{\\beta(\\varepsilon_i-\\mu)}+1}"],
    commonMisunderstandings: ["把 Fermi 能和平均能量混淆", "忽略自旋简并度", "高温经典极限判断不清"],
    studyOrder: 14,
    difficulty: "advanced",
    tags: ["费米子", "Fermi 能", "Pauli 原理"],
  },
  {
    id: "fluctuation-theory",
    course: "thermo-stat",
    title: "涨落理论",
    alias: ["热涨落", "fluctuation"],
    description:
      "涨落理论研究热力学量围绕平衡值的统计偏离。涨落大小与系统尺度和响应函数有关。",
    textbookStyleSummary:
      "热力学极限下相对涨落通常趋于零，但有限系统或临界点附近涨落不可忽略。不同系综中允许涨落的变量不同。",
    prerequisites: ["正则系综", "巨正则系综"],
    related: ["相平衡", "Green 函数"],
    typicalProblems: ["能量涨落与热容关系", "粒子数涨落", "临界点附近涨落增强"],
    keyFormulas: ["\\langle(\\Delta E)^2\\rangle=k_BT^2C_V", "\\langle(\\Delta N)^2\\rangle=k_BT\\left(\\frac{\\partial N}{\\partial \\mu}\\right)_{T,V}"],
    commonMisunderstandings: ["误认为平衡态完全没有涨落", "不同系综的涨落变量混淆", "把绝对涨落和相对涨落趋势混淆"],
    studyOrder: 15,
    difficulty: "advanced",
    tags: ["涨落", "响应函数", "热力学极限"],
  },
  {
    id: "general-mechanics",
    course: "general-physics",
    title: "质点运动与 Newton 定律",
    alias: ["普通力学", "运动学与动力学", "Newton's laws"],
    description:
      "以质点模型描述物体运动，并用 Newton 定律建立力与运动状态变化之间的关系。建模时必须先选定参考系和正方向。",
    textbookStyleSummary:
      "先根据研究尺度判断质点近似是否成立，再画受力图并在选定参考系中列分量方程。只有惯性系中才能直接使用 Newton 第二定律的标准形式。",
    prerequisites: [],
    related: ["动量与机械能", "振动与波", "理论力学"],
    typicalProblems: ["斜面与连接体动力学", "圆周运动约束条件", "变力作用下的运动"],
    keyFormulas: ["\\mathbf F=m\\mathbf a", "\\mathbf p=m\\mathbf v"],
    commonMisunderstandings: ["把速度方向等同于合力方向", "漏画约束力", "未说明参考系就直接列方程"],
    studyOrder: 1,
    difficulty: "basic",
    tags: ["参考系", "受力分析", "运动方程"],
  },
  {
    id: "momentum-energy",
    course: "general-physics",
    title: "动量、角动量与机械能",
    alias: ["守恒定律", "冲量动量定理", "功能原理"],
    description:
      "动量、角动量和能量方法从不同角度描述系统状态变化。使用守恒定律前必须先检查相应的外力、外力矩或非保守功条件。",
    textbookStyleSummary:
      "守恒定律是相应定理在特定条件下的结果。选取系统边界后，应明确哪些相互作用属于内力，哪些能量形式计入系统机械能。",
    prerequisites: ["质点运动与 Newton 定律"],
    related: ["刚体力学", "碰撞", "中心力场"],
    typicalProblems: ["碰撞与反冲", "变质量问题", "含摩擦过程的功能关系"],
    keyFormulas: [
      "\\Delta\\mathbf p=\\int\\mathbf F_{\\mathrm{ext}}\\,dt",
      "\\Delta E_k=W",
    ],
    commonMisunderstandings: ["把动量守恒和机械能守恒同时默认成立", "系统边界前后不一致", "忽略势能零点约定"],
    studyOrder: 2,
    difficulty: "basic",
    tags: ["守恒定律", "系统边界", "碰撞"],
  },
  {
    id: "general-thermodynamics",
    course: "general-physics",
    title: "热学基础与热力学过程",
    alias: ["普通热学", "理想气体", "热力学第一定律"],
    description:
      "研究温度、内能、热量和功之间的关系，并用状态方程描述平衡态。过程量和状态量必须严格区分。",
    textbookStyleSummary:
      "热力学第一定律是能量守恒在热过程中的表达。符号约定、准静态条件和过程路径会影响功与热量的计算。",
    prerequisites: [],
    related: ["热力学基本规律", "分子动理论"],
    typicalProblems: ["理想气体准静态过程", "循环过程效率", "热容与多方过程"],
    keyFormulas: ["dU=\\delta Q-\\delta W", "pV=nRT"],
    commonMisunderstandings: ["把热量当作系统状态量", "混用不同功的符号约定", "忽略过程是否准静态"],
    studyOrder: 3,
    difficulty: "basic",
    tags: ["状态量", "过程量", "理想气体"],
  },
  {
    id: "general-electromagnetism",
    course: "general-physics",
    title: "电磁学基础",
    alias: ["大学物理电磁学", "电场与磁场", "电磁感应"],
    description:
      "从电荷、电流及其产生的电磁场出发，讨论场的叠加、通量、环流和电磁感应。对称性决定积分定律是否便于直接求场。",
    textbookStyleSummary:
      "Gauss 定律和 Ampere 环路定律本身普遍成立，但只有在对称性足够时才能直接由积分式求出场强。时变磁场产生涡旋电场。",
    prerequisites: ["矢量与积分基础"],
    related: ["静电场", "静磁场", "Maxwell 方程组"],
    typicalProblems: ["高对称电荷分布求场", "载流导体磁场", "电磁感应与动生电动势"],
    keyFormulas: [
      "\\oint_S\\mathbf E\\cdot d\\mathbf S=\\frac{Q_{\\mathrm{in}}}{\\varepsilon_0}",
      "\\mathcal E=-\\frac{d\\Phi_B}{dt}",
    ],
    commonMisunderstandings: ["有 Gauss 定律就一定能直接求场", "混淆电势差与电动势", "忽略磁通量正方向约定"],
    studyOrder: 4,
    difficulty: "intermediate",
    tags: ["对称性", "通量", "环流", "感应"],
  },
  {
    id: "oscillation-wave-optics",
    course: "general-physics",
    title: "振动、波动与光学基础",
    alias: ["简谐振动", "机械波", "波动光学"],
    description:
      "振动描述局域系统随时间的周期变化，波动描述扰动在空间中的传播。干涉和衍射体现波的叠加与相位关系。",
    textbookStyleSummary:
      "简谐振动成立于线性回复力近似。波函数中的相位决定传播方向和干涉条件；几何光学是波长远小于系统尺度时的近似。",
    prerequisites: ["质点运动与 Newton 定律"],
    related: ["小振动", "电磁波", "Fourier 方法"],
    typicalProblems: ["简谐振动参数确定", "驻波与边界条件", "双缝干涉与单缝衍射"],
    keyFormulas: [
      "\\ddot x+\\omega_0^2x=0",
      "y(x,t)=A\\cos(kx-\\omega t+\\varphi)",
    ],
    commonMisunderstandings: ["把介质质点速度与波速混淆", "忽略相位差中的路径和初相位", "把几何光学结论用于明显衍射尺度"],
    studyOrder: 5,
    difficulty: "intermediate",
    tags: ["相位", "叠加", "边界条件", "干涉"],
  },
  {
    id: "physics-experiment-teaching",
    course: "general-physics",
    title: "物理实验与教学设计",
    alias: ["实验设计", "误差分析", "中学物理教学"],
    description:
      "把物理规律转化为可测量方案，并通过控制变量、数据处理和不确定度评价形成证据链。教学设计还需考虑学生已有认知和概念形成过程。",
    textbookStyleSummary:
      "实验方案应形成理论预测、测量量、仪器选择、数据处理和误差分析的闭环。教学活动应服务于可观察的学习目标，而不是只安排演示步骤。",
    prerequisites: ["质点运动与 Newton 定律", "电磁学基础"],
    related: ["数据处理", "科学探究", "物理建模"],
    typicalProblems: ["验证性实验设计", "控制变量与数据表设计", "不确定度传播", "概念转变教学活动"],
    keyFormulas: [
      "u_f^2=\\sum_i\\left(\\frac{\\partial f}{\\partial x_i}\\right)^2u_{x_i}^2",
    ],
    commonMisunderstandings: ["只写操作步骤而没有理论判据", "把系统误差和随机误差混淆", "教学目标无法通过活动或证据检验"],
    studyOrder: 6,
    difficulty: "intermediate",
    tags: ["可测量性", "控制变量", "不确定度", "教学目标"],
  },
];

export function getKnowledgeByCourse(courseId: CourseId) {
  return knowledgeItems
    .filter((item) => item.course === courseId)
    .sort((a, b) => a.studyOrder - b.studyOrder);
}

export function getKnowledgeItem(id?: string) {
  if (!id) {
    return undefined;
  }

  const normalized = id.trim().toLowerCase();
  return knowledgeItems.find((item) => {
    if (item.id === id || item.title === id) {
      return true;
    }

    return item.alias?.some((alias) => alias.toLowerCase() === normalized);
  });
}

export function getKnowledgeTitle(id?: string) {
  return getKnowledgeItem(id)?.title ?? id ?? "";
}

export function getRelatedKnowledgeItems(item?: KnowledgeItem) {
  if (!item) {
    return [];
  }

  return item.related
    .map((title) => knowledgeItems.find((candidate) => candidate.title === title))
    .filter((candidate): candidate is KnowledgeItem => Boolean(candidate));
}

export function getCourseStats() {
  return courseOptions.map((course) => ({
    ...course,
    count: getKnowledgeByCourse(course.id).length,
    label: getCourseLabel(course.id),
  }));
}
