import { courseOptions, getCourseLabel } from "@/data/courses";
import type { CourseId, KnowledgeItem } from "@/types/learning";

const coreKnowledgeItems: KnowledgeItem[] = [
  {
    id: "particle-motion-newton-laws",
    course: "general-physics",
    title: "Particle Motion and Newton's Laws",
    alias: ["Newtonian motion", "kinematics", "dynamics"],
    description:
      "Particle mechanics studies motion under specified forces in an inertial frame. It connects force laws, acceleration, initial data, and observable trajectories.",
    textbookStyleSummary:
      "A complete mechanics problem should state the reference frame, force model, initial conditions, and constraints. Newton's second law is a differential equation for motion, not only an algebraic relation between force and acceleration.",
    prerequisites: [],
    related: ["Momentum, Angular Momentum, and Mechanical Energy", "Oscillations, Waves, and Optics"],
    typicalProblems: ["Motion under a variable force", "Projectile motion with constraints", "Work-energy analysis for one-dimensional motion"],
    keyFormulas: ["\\mathbf{F}=m\\mathbf{a}", "\\mathbf{v}=\\frac{d\\mathbf{r}}{dt},\\quad \\mathbf{a}=\\frac{d\\mathbf{v}}{dt}"],
    commonMisunderstandings: ["Using Newton's laws without specifying the frame", "Treating acceleration as always parallel to velocity", "Confusing net force with a single applied force"],
    studyOrder: 1,
    difficulty: "basic",
    tags: ["kinematics", "Newton's laws", "initial conditions"],
  },
  {
    id: "momentum-angular-momentum-energy",
    course: "general-physics",
    title: "Momentum, Angular Momentum, and Mechanical Energy",
    alias: ["conservation laws", "impulse", "work-energy theorem"],
    description:
      "Conservation laws provide compact descriptions of mechanical systems when the relevant external force, torque, or nonconservative work is controlled.",
    textbookStyleSummary:
      "Momentum conservation requires negligible external impulse, angular momentum conservation requires negligible external torque about the chosen point, and mechanical energy conservation requires conservative forces or an explicit work term.",
    prerequisites: ["Particle Motion and Newton's Laws"],
    related: ["Particle Motion and Newton's Laws", "Rigid-Body Dynamics"],
    typicalProblems: ["Collision and impulse problems", "Central-force angular momentum analysis", "Work-energy calculations with constraints"],
    keyFormulas: ["\\frac{d\\mathbf{P}}{dt}=\\mathbf{F}_{\\mathrm{ext}}", "\\frac{d\\mathbf{L}}{dt}=\\boldsymbol{\\tau}_{\\mathrm{ext}}", "\\Delta K=W"],
    commonMisunderstandings: ["Assuming kinetic energy is conserved in every collision", "Changing the torque origin without checking definitions", "Forgetting external impulses during short collisions"],
    studyOrder: 2,
    difficulty: "basic",
    tags: ["momentum", "angular momentum", "energy"],
  },
  {
    id: "thermal-processes",
    course: "general-physics",
    title: "Thermal Processes and Ideal Gases",
    alias: ["ideal gas", "heat capacity", "thermodynamic process"],
    description:
      "Basic thermal physics describes macroscopic states, quasi-static processes, heat, work, and the ideal-gas model.",
    textbookStyleSummary:
      "Heat and work are path-dependent energy transfers, while internal energy and state variables describe the system state. A process calculation must specify the path or constraint, such as isothermal, adiabatic, isobaric, or isochoric.",
    prerequisites: [],
    related: ["Thermodynamic Laws", "Thermodynamic Potentials"],
    typicalProblems: ["Ideal-gas process diagrams", "Cycle efficiency calculations", "Heat capacity and polytropic-process problems"],
    keyFormulas: ["pV=nRT", "dU=\\delta Q-\\delta W", "C_V=\\left(\\frac{\\partial U}{\\partial T}\\right)_V"],
    commonMisunderstandings: ["Treating heat as a state variable", "Mixing sign conventions for work", "Applying reversible formulas to irreversible processes without justification"],
    studyOrder: 3,
    difficulty: "basic",
    tags: ["ideal gas", "heat", "work"],
  },
  {
    id: "electromagnetism-basics",
    course: "general-physics",
    title: "Electromagnetism Basics",
    alias: ["electric field", "magnetic field", "electromagnetic induction"],
    description:
      "Introductory electromagnetism relates charges, currents, fields, flux, circulation, and induction through integral field laws.",
    textbookStyleSummary:
      "Integral laws are most useful when symmetry is strong enough to determine the field on the integration surface or path. Induction problems also require a clear sign convention for flux and electromotive force.",
    prerequisites: ["Vector Calculus Basics"],
    related: ["Electrostatics", "Magnetostatics", "Maxwell Equations"],
    typicalProblems: ["Fields of symmetric charge distributions", "Magnetic fields of steady currents", "Induced electromotive force in moving circuits"],
    keyFormulas: ["\\oint \\mathbf{E}\\cdot d\\mathbf{S}=\\frac{Q_{\\mathrm{enc}}}{\\varepsilon_0}", "\\oint \\mathbf{B}\\cdot d\\boldsymbol{\\ell}=\\mu_0 I_{\\mathrm{enc}}", "\\mathcal{E}=-\\frac{d\\Phi_B}{dt}"],
    commonMisunderstandings: ["Expecting Gauss's law to directly solve fields without symmetry", "Confusing potential difference with electromotive force", "Dropping the orientation convention in Faraday's law"],
    studyOrder: 4,
    difficulty: "basic",
    tags: ["field laws", "symmetry", "induction"],
  },
  {
    id: "oscillation-wave-optics",
    course: "general-physics",
    title: "Oscillations, Waves, and Optics",
    alias: ["simple harmonic motion", "mechanical waves", "wave optics"],
    description:
      "Oscillations describe local periodic motion, while waves describe propagation of disturbances through space. Interference and diffraction follow from superposition and phase.",
    textbookStyleSummary:
      "Simple harmonic motion is a linear approximation near stable equilibrium. Wave problems require distinguishing medium-particle velocity, wave speed, phase velocity, boundary conditions, and phase differences.",
    prerequisites: ["Particle Motion and Newton's Laws"],
    related: ["Small Oscillations", "Electromagnetic Waves", "Fourier Series and Fourier Transform"],
    typicalProblems: ["Determining oscillator parameters", "Standing waves with boundary conditions", "Double-slit interference and single-slit diffraction"],
    keyFormulas: ["x(t)=A\\cos(\\omega t+\\phi)", "\\frac{\\partial^2 y}{\\partial t^2}=v^2\\frac{\\partial^2 y}{\\partial x^2}", "d\\sin\\theta=m\\lambda"],
    commonMisunderstandings: ["Confusing wave speed with medium-particle speed", "Ignoring initial phase in interference", "Using geometric optics outside its scale of validity"],
    studyOrder: 5,
    difficulty: "basic",
    tags: ["oscillation", "phase", "superposition"],
  },
  {
    id: "experimental-measurement-uncertainty",
    course: "general-physics",
    title: "Experimental Measurement and Uncertainty",
    alias: ["measurement", "uncertainty analysis", "experimental physics", "实验测量", "误差分析", "不确定度"],
    description:
      "Experimental measurement connects physical quantities to instruments, data processing, uncertainty estimates, and model checks.",
    textbookStyleSummary:
      "A complete measurement problem should state the measured quantity, instrument resolution, repeated-data treatment, uncertainty propagation, and the criterion used to compare the result with a physical model.",
    prerequisites: ["Particle Motion and Newton's Laws", "Electromagnetism Basics"],
    related: ["Data Analysis", "Scientific Modeling"],
    typicalProblems: ["Controlled-variable measurements", "Uncertainty propagation", "Linear fitting from experimental data"],
    keyFormulas: ["u_f^2=\\sum_i\\left(\\frac{\\partial f}{\\partial x_i}u_{x_i}\\right)^2"],
    commonMisunderstandings: ["Reporting precision without uncertainty", "Confusing systematic and random uncertainty", "Comparing results without a stated confidence criterion"],
    studyOrder: 6,
    difficulty: "intermediate",
    tags: ["measurement", "uncertainty", "data analysis"],
  },
  {
    id: "complex-functions",
    course: "math-physics",
    title: "Complex Functions",
    alias: ["analytic functions", "residue theorem", "complex variables", "复变函数", "解析函数", "留数定理"],
    description:
      "Complex functions study differentiability, analyticity, contour integration, singularities, and residues on the complex plane.",
    textbookStyleSummary:
      "Before applying contour integration, identify the analytic domain, singularity types, branch cuts, and contour orientation. Cauchy's theorem and the residue theorem depend on analyticity inside the relevant region.",
    prerequisites: [],
    related: ["Integral Transforms", "Special Functions", "Green's Functions"],
    typicalProblems: ["Testing analyticity using Cauchy-Riemann equations", "Evaluating real integrals with residues", "Finding Laurent expansions and residues"],
    keyFormulas: [
      "\\frac{\\partial u}{\\partial x}=\\frac{\\partial v}{\\partial y},\\quad \\frac{\\partial u}{\\partial y}=-\\frac{\\partial v}{\\partial x}",
      "\\oint_C f(z)\\,dz=2\\pi i\\sum_k \\operatorname{Res}(f,z_k)",
    ],
    commonMisunderstandings: ["Confusing real differentiability with complex analyticity", "Ignoring which singularities lie inside the contour", "Treating branch points like isolated poles"],
    studyOrder: 1,
    difficulty: "basic",
    tags: ["analyticity", "contour integration", "residues"],
  },
  {
    id: "fourier-series-transform",
    course: "math-physics",
    title: "Fourier Series and Fourier Transform",
    alias: ["Fourier analysis", "orthogonal expansion", "frequency spectrum", "傅里叶级数", "傅里叶变换"],
    description:
      "Fourier methods represent functions by orthogonal trigonometric modes or continuous spectral components.",
    textbookStyleSummary:
      "Fourier series apply to finite-interval or periodic expansions, while Fourier transforms describe continuous spectra on unbounded domains. Always state the interval, normalization convention, and convergence interpretation.",
    prerequisites: ["Complex Functions", "Ordinary Differential Equations"],
    related: ["Separation of Variables", "Sturm-Liouville Eigenvalue Problems", "Integral Transforms"],
    typicalProblems: ["Sine and cosine series expansions", "Computing Fourier transforms and inverse transforms", "Using spectral decompositions for wave and heat equations"],
    keyFormulas: [
      "f(x)\\sim \\frac{a_0}{2}+\\sum_{n=1}^{\\infty}(a_n\\cos nx+b_n\\sin nx)",
      "\\hat f(k)=\\int_{-\\infty}^{\\infty} f(x)e^{-ikx}\\,dx",
    ],
    commonMisunderstandings: ["Forgetting endpoint convergence to the half-sum", "Mixing normalization conventions", "Confusing periodic series with whole-line transforms"],
    studyOrder: 2,
    difficulty: "basic",
    tags: ["orthogonality", "spectrum", "series"],
  },
  {
    id: "laplace-transform",
    course: "math-physics",
    title: "Laplace Transform",
    alias: ["operational transform", "initial-value transform"],
    description:
      "The Laplace transform converts many linear initial-value problems into algebraic equations in a complex variable.",
    textbookStyleSummary:
      "Initial data enter through derivative transform formulas. Inversion requires attention to poles, convergence regions, step functions, impulse terms, and the physical domain of time.",
    prerequisites: ["Ordinary Differential Equations", "Complex Functions"],
    related: ["Integral Transforms", "Equations of Mathematical Physics", "Green's Functions"],
    typicalProblems: ["Solving linear differential equations with initial data", "Handling step and impulse forcing", "Using convolution to compute response functions"],
    keyFormulas: ["\\mathcal{L}\\{f'(t)\\}=sF(s)-f(0)", "\\mathcal{L}\\{f*g\\}=F(s)G(s)"],
    commonMisunderstandings: ["Dropping initial-value terms", "Confusing the transform variable with a spatial coordinate", "Skipping the inverse-transform domain check"],
    studyOrder: 3,
    difficulty: "basic",
    tags: ["initial-value problem", "convolution", "response"],
  },
  {
    id: "integral-transforms",
    course: "math-physics",
    title: "Integral Transforms",
    alias: ["transform kernels", "Fourier transform", "Laplace transform"],
    description:
      "Integral transforms map a function into another variable space through a kernel, often simplifying differential equations.",
    textbookStyleSummary:
      "The choice of transform is determined by the domain, boundary conditions, source terms, and desired spectral representation. A solution in transform space must be inverted and checked against the original conditions.",
    prerequisites: ["Fourier Series and Fourier Transform", "Laplace Transform"],
    related: ["Equations of Mathematical Physics", "Green's Functions"],
    typicalProblems: ["Solving Poisson equations with Fourier transforms", "Solving heat initial-value problems with Laplace transforms", "Applying convolution theorems"],
    keyFormulas: ["\\mathcal{T}\\{f\\}(s)=\\int K(s,x)f(x)\\,dx"],
    commonMisunderstandings: ["Failing to state the kernel and normalization", "Losing boundary terms", "Treating multiplication in transform space as ordinary-space multiplication"],
    studyOrder: 4,
    difficulty: "intermediate",
    tags: ["kernel", "inverse transform", "convolution"],
  },
  {
    id: "mathematical-physics-equations",
    course: "math-physics",
    title: "Equations of Mathematical Physics",
    alias: ["partial differential equations", "PDE", "wave heat Laplace equations"],
    description:
      "Mathematical physics equations include wave, heat, Laplace, and Poisson equations together with the conditions that make them well posed.",
    textbookStyleSummary:
      "The differential equation gives a local relation, while the domain, boundary conditions, and initial conditions define the actual physical problem. Hyperbolic, parabolic, and elliptic equations require different data and methods.",
    prerequisites: ["Fourier Series and Fourier Transform"],
    related: ["Well-Posed Boundary-Value Problems", "Separation of Variables", "Green's Functions"],
    typicalProblems: ["Vibrating-string initial-boundary value problems", "Heat conduction on a finite interval", "Poisson boundary-value problems"],
    keyFormulas: [
      "\\frac{\\partial^2 u}{\\partial t^2}=c^2\\nabla^2 u",
      "\\frac{\\partial u}{\\partial t}=\\alpha\\nabla^2 u",
      "\\nabla^2 u=-\\frac{\\rho}{\\varepsilon_0}",
    ],
    commonMisunderstandings: ["Writing the equation without the data", "Mixing initial and boundary conditions", "Not distinguishing homogeneous and inhomogeneous problems"],
    studyOrder: 5,
    difficulty: "intermediate",
    tags: ["PDE", "boundary data", "classification"],
  },
  {
    id: "well-posed-problems",
    course: "math-physics",
    title: "Well-Posed Boundary-Value Problems",
    alias: ["boundary-value problem", "initial-boundary value problem", "well-posedness"],
    description:
      "A well-posed problem combines an equation, domain, boundary data, and sometimes initial data so that the solution is physically meaningful.",
    textbookStyleSummary:
      "The same equation can represent different systems under different boundary conditions. Dirichlet, Neumann, and Robin conditions must be stated on the correct boundary, with compatibility conditions checked when needed.",
    prerequisites: ["Equations of Mathematical Physics"],
    related: ["Separation of Variables", "Green's Functions", "Electrostatic Boundary-Value Problems"],
    typicalProblems: ["Laplace equations on bounded regions", "Mixed boundary heat problems", "Checking uniqueness under given data"],
    keyFormulas: ["u|_{\\partial\\Omega}=f", "\\frac{\\partial u}{\\partial n}\\bigg|_{\\partial\\Omega}=g"],
    commonMisunderstandings: ["Confusing boundary values with normal derivatives", "Ignoring geometry restrictions", "Failing to verify all conditions after solving"],
    studyOrder: 6,
    difficulty: "intermediate",
    tags: ["Dirichlet", "Neumann", "well-posedness"],
  },
  {
    id: "separation-of-variables",
    course: "math-physics",
    title: "Separation of Variables",
    alias: ["variable separation", "eigenfunction expansion", "分离变量法", "变量分离法"],
    description:
      "Separation of variables reduces many linear homogeneous boundary-value problems to ordinary differential eigenvalue problems.",
    textbookStyleSummary:
      "Separation constants become eigenvalues because boundary conditions restrict the allowed modes. Orthogonality and completeness are what allow initial data or boundary functions to be expanded in those modes.",
    prerequisites: ["Well-Posed Boundary-Value Problems", "Fourier Series and Fourier Transform"],
    related: ["Sturm-Liouville Eigenvalue Problems", "Special Functions", "Electrostatic Boundary-Value Problems"],
    typicalProblems: ["Rectangular-region Laplace problems", "Finite-rod heat conduction", "Cylindrical or spherical coordinate boundary-value problems"],
    keyFormulas: ["u(x,t)=X(x)T(t)", "\\int_a^b w(x)X_m(x)X_n(x)\\,dx=0\\quad(m\\ne n)"],
    commonMisunderstandings: ["Choosing the sign of the separation constant without checking boundary data", "Not using boundary conditions to determine eigenvalues", "Computing expansion coefficients without the weight function"],
    studyOrder: 7,
    difficulty: "intermediate",
    tags: ["eigenvalues", "orthogonality", "boundary conditions"],
  },
  {
    id: "sturm-liouville",
    course: "math-physics",
    title: "Sturm-Liouville Eigenvalue Problems",
    alias: ["self-adjoint eigenvalue problem", "weighted orthogonality"],
    description:
      "Sturm-Liouville theory explains why many separated differential equations have real eigenvalues and orthogonal eigenfunctions.",
    textbookStyleSummary:
      "The coefficient functions, boundary conditions, and weight function determine self-adjointness, orthogonality, normalization, and the validity of eigenfunction expansions.",
    prerequisites: ["Separation of Variables", "Linear Algebra"],
    related: ["Special Functions", "Green's Functions", "Operators and Observables"],
    typicalProblems: ["Checking self-adjointness", "Finding eigenvalues and eigenfunctions", "Expanding functions using a weight function"],
    keyFormulas: ["\\frac{d}{dx}\\left[p(x)\\frac{dy}{dx}\\right]+[\\lambda w(x)-q(x)]y=0"],
    commonMisunderstandings: ["Forgetting the weight function", "Confusing orthogonality with normalization", "Ignoring how boundary conditions enter self-adjointness"],
    studyOrder: 8,
    difficulty: "advanced",
    tags: ["self-adjointness", "weight function", "completeness"],
  },
  {
    id: "green-functions",
    course: "math-physics",
    title: "Green's Functions",
    alias: ["Green function", "response function", "linear operator kernel", "green-function", "Green 函数", "格林函数"],
    description:
      "A Green's function is the response of a linear operator to a unit point source under specified boundary conditions.",
    textbookStyleSummary:
      "The Green's function satisfies an auxiliary equation with a delta function and boundary conditions compatible with the original problem. The solution of an inhomogeneous problem is written as an integral over sources weighted by this kernel.",
    prerequisites: ["Well-Posed Boundary-Value Problems", "Sturm-Liouville Eigenvalue Problems"],
    related: ["Electrostatic Boundary-Value Problems", "Scattering Theory", "Fluctuations"],
    typicalProblems: ["Constructing one-dimensional Green's functions", "Using images to obtain electrostatic Green's functions", "Expanding Green's functions in eigenfunctions"],
    keyFormulas: ["L G(x,\\xi)=\\delta(x-\\xi)", "u(x)=\\int G(x,\\xi)f(\\xi)\\,d\\xi"],
    commonMisunderstandings: ["Treating the Green's function as independent of boundary conditions", "Confusing source and field variables", "Missing derivative jump conditions from the delta function"],
    studyOrder: 9,
    difficulty: "advanced",
    tags: ["response", "delta function", "linear operator"],
  },
  {
    id: "special-functions",
    course: "math-physics",
    title: "Special Functions",
    alias: ["Legendre functions", "Bessel functions", "Hermite polynomials"],
    description:
      "Special functions arise as eigenfunctions for separated equations in coordinate systems adapted to physical symmetry.",
    textbookStyleSummary:
      "Study special functions through their differential equations, boundary conditions, recurrence relations, orthogonality, and normalization. Their zeros often determine eigenvalues in physical problems.",
    prerequisites: ["Sturm-Liouville Eigenvalue Problems", "Separation of Variables"],
    related: ["Central-Force Motion", "One-Dimensional Stationary States", "Electrostatic Boundary-Value Problems"],
    typicalProblems: ["Legendre expansions in spherical symmetry", "Bessel zero problems in cylindrical domains", "Hermite polynomials in oscillator eigenfunctions"],
    keyFormulas: ["(1-x^2)y''-2xy'+\\ell(\\ell+1)y=0", "x^2y''+xy'+(x^2-\\nu^2)y=0"],
    commonMisunderstandings: ["Memorizing formulas without the coordinate system", "Forgetting that zeros can determine eigenvalues", "Mixing normalization conventions"],
    studyOrder: 10,
    difficulty: "advanced",
    tags: ["Legendre", "Bessel", "orthogonal polynomials"],
  },
  {
    id: "variational-method-basics",
    course: "math-physics",
    title: "Basics of Variational Methods",
    alias: ["Euler-Lagrange equation", "functional extremum"],
    description:
      "Variational methods study extrema of functionals on spaces of admissible functions and underpin mechanics, field theory, and approximate quantum methods.",
    textbookStyleSummary:
      "The first variation of a functional gives the Euler-Lagrange equation, while boundary conditions determine the allowed variations and boundary terms. A functional extremum is not the same as an ordinary function extremum.",
    prerequisites: ["Calculus", "Ordinary Differential Equations"],
    related: ["Lagrange Equations", "Hamilton's Principle", "Perturbation Theory"],
    typicalProblems: ["Deriving Euler-Lagrange equations", "Handling fixed-endpoint variations", "Finding shortest-path or least-action conditions"],
    keyFormulas: ["\\delta J[y]=0", "\\frac{\\partial F}{\\partial y}-\\frac{d}{dx}\\frac{\\partial F}{\\partial y'}=0"],
    commonMisunderstandings: ["Treating variation symbols as ordinary differentials", "Not stating endpoint conditions", "Dropping boundary terms without justification"],
    studyOrder: 11,
    difficulty: "intermediate",
    tags: ["functional", "Euler-Lagrange", "extremum"],
  },
  {
    id: "particle-systems",
    course: "theoretical-mechanics",
    title: "Systems of Particles",
    alias: ["center of mass", "many-particle mechanics"],
    description:
      "Systems of particles are described through total momentum, center-of-mass motion, angular momentum, and energy balances.",
    textbookStyleSummary:
      "Separate internal and external forces before applying system-level theorems. The center of mass responds to the total external force, while angular momentum changes with external torque about the chosen point.",
    prerequisites: ["Particle Motion and Newton's Laws"],
    related: ["Rigid-Body Dynamics", "Virtual Work and Constraints"],
    typicalProblems: ["Center-of-mass theorem", "Collision analysis", "Variable-mass momentum balance"],
    keyFormulas: ["M\\mathbf{R}_{\\mathrm{cm}}=\\sum_i m_i\\mathbf{r}_i", "\\frac{d\\mathbf{P}}{dt}=\\mathbf{F}_{\\mathrm{ext}}"],
    commonMisunderstandings: ["Counting internal forces as external forces", "Using mechanical energy conservation in inelastic collisions", "Mixing laboratory and center-of-mass frames"],
    studyOrder: 1,
    difficulty: "basic",
    tags: ["center of mass", "momentum", "angular momentum"],
  },
  {
    id: "central-force-motion",
    course: "theoretical-mechanics",
    title: "Central-Force Motion",
    alias: ["Kepler problem", "effective potential"],
    description:
      "Central-force problems reduce three-dimensional motion to planar radial motion through angular momentum conservation.",
    textbookStyleSummary:
      "Because the torque vanishes, the motion is planar and angular momentum is conserved. The effective potential combines the true potential with the centrifugal term and determines allowed radial motion.",
    prerequisites: ["Particle Motion and Newton's Laws"],
    related: ["Hamiltonian Equations", "Scattering Theory"],
    typicalProblems: ["Inverse-square orbits", "Effective-potential analysis", "Classical scattering by a central potential"],
    keyFormulas: ["U_{\\mathrm{eff}}(r)=U(r)+\\frac{L^2}{2mr^2}", "\\frac{d^2u}{d\\theta^2}+u=-\\frac{m}{L^2u^2}F(1/u)"],
    commonMisunderstandings: ["Assuming radial force means radial velocity is constant", "Ignoring the planar-motion consequence of angular momentum conservation", "Confusing real potential with effective potential"],
    studyOrder: 2,
    difficulty: "intermediate",
    tags: ["central force", "effective potential", "orbit"],
  },
  {
    id: "rigid-body-kinematics",
    course: "theoretical-mechanics",
    title: "Rigid-Body Kinematics",
    alias: ["Euler angles", "rigid rotation"],
    description:
      "Rigid-body kinematics describes translation and rotation of a body whose internal distances remain fixed.",
    textbookStyleSummary:
      "General rigid motion can be decomposed into center-of-mass translation plus rotation. Euler-angle formulas depend on the chosen convention, so the rotation sequence must be stated.",
    prerequisites: ["Systems of Particles"],
    related: ["Rigid-Body Dynamics", "Non-Inertial Frames"],
    typicalProblems: ["Velocity and acceleration of points on a rigid body", "Euler-angle angular velocity", "Rolling without slipping"],
    keyFormulas: ["\\mathbf{v}=\\mathbf{V}_{\\mathrm{cm}}+\\boldsymbol{\\omega}\\times\\mathbf{r}'"],
    commonMisunderstandings: ["Identifying angular velocity with a single Euler-angle rate", "Missing rotating-frame relative terms", "Writing the rolling constraint in the wrong direction"],
    studyOrder: 3,
    difficulty: "intermediate",
    tags: ["angular velocity", "Euler angles", "rolling"],
  },
  {
    id: "rigid-body-dynamics",
    course: "theoretical-mechanics",
    title: "Rigid-Body Dynamics",
    alias: ["Euler equations", "inertia tensor"],
    description:
      "Rigid-body dynamics studies rotational motion under torques using angular momentum, inertia tensors, principal axes, and body-frame equations.",
    textbookStyleSummary:
      "Angular momentum is generally not parallel to angular velocity unless expressed along principal axes. Euler's equations are usually written in the body-fixed principal-axis frame.",
    prerequisites: ["Rigid-Body Kinematics", "Systems of Particles"],
    related: ["Non-Inertial Frames", "Lagrange Equations"],
    typicalProblems: ["Motion of a symmetric top", "Principal-axis inertia calculations", "Torque-free rigid-body motion"],
    keyFormulas: ["\\mathbf{L}=\\mathbf{I}\\boldsymbol{\\omega}", "\\frac{d\\mathbf{L}}{dt}=\\boldsymbol{\\tau}"],
    commonMisunderstandings: ["Assuming angular momentum is always parallel to angular velocity", "Using space-frame derivatives in body-frame equations", "Ignoring products of inertia"],
    studyOrder: 4,
    difficulty: "advanced",
    tags: ["inertia tensor", "Euler equations", "principal axes"],
  },
  {
    id: "non-inertial-frames",
    course: "theoretical-mechanics",
    title: "Non-Inertial Frames",
    alias: ["rotating frames", "fictitious forces"],
    description:
      "Non-inertial-frame dynamics rewrites motion in accelerating or rotating frames by introducing inertial forces.",
    textbookStyleSummary:
      "The form of inertial forces depends on the frame acceleration and angular velocity. Centrifugal, Coriolis, and Euler forces are bookkeeping terms that make Newton's equation usable in the non-inertial frame.",
    prerequisites: ["Particle Motion and Newton's Laws", "Rigid-Body Kinematics"],
    related: ["Rigid-Body Dynamics", "Small Oscillations"],
    typicalProblems: ["Motion on a rotating disk", "Coriolis deflection", "Effective gravity in accelerating frames"],
    keyFormulas: ["\\mathbf{a}=\\mathbf{a}' +2\\boldsymbol{\\Omega}\\times\\mathbf{v}'+\\boldsymbol{\\Omega}\\times(\\boldsymbol{\\Omega}\\times\\mathbf{r})+\\dot{\\boldsymbol{\\Omega}}\\times\\mathbf{r}"],
    commonMisunderstandings: ["Treating inertial forces as interactions from other bodies", "Forgetting the Coriolis term", "Using rotating-frame formulas in inertial coordinates"],
    studyOrder: 5,
    difficulty: "intermediate",
    tags: ["rotating frame", "Coriolis force", "effective force"],
  },
  {
    id: "virtual-work",
    course: "theoretical-mechanics",
    title: "Virtual Work and Constraints",
    alias: ["virtual displacement", "generalized force", "constraints"],
    description:
      "The principle of virtual work expresses equilibrium or constrained motion using virtual displacements compatible with constraints.",
    textbookStyleSummary:
      "Virtual displacements are instantaneous admissible variations, not actual time evolution. Ideal constraint forces do no virtual work, which is why they can be eliminated in many Lagrangian formulations.",
    prerequisites: ["Systems of Particles"],
    related: ["Lagrange Equations", "Hamilton's Principle"],
    typicalProblems: ["Equilibrium with constraints", "Finding generalized forces", "Using virtual work to avoid constraint reactions"],
    keyFormulas: ["\\sum_i \\mathbf{F}_i\\cdot\\delta\\mathbf{r}_i=0", "Q_j=\\sum_i \\mathbf{F}_i\\cdot\\frac{\\partial\\mathbf{r}_i}{\\partial q_j}"],
    commonMisunderstandings: ["Confusing virtual displacement with actual displacement", "Assuming every constraint is ideal", "Using generalized coordinates before checking independence"],
    studyOrder: 6,
    difficulty: "intermediate",
    tags: ["constraints", "virtual displacement", "generalized force"],
  },
  {
    id: "lagrange-equations",
    course: "theoretical-mechanics",
    title: "Lagrange Equations",
    alias: ["Lagrangian mechanics", "generalized coordinates"],
    description:
      "Lagrange equations describe systems using generalized coordinates and the Lagrangian rather than explicit constraint forces.",
    textbookStyleSummary:
      "Choose independent generalized coordinates consistent with the constraints, write kinetic and potential energies in those coordinates, and derive equations from the stationary-action or d'Alembert formulation.",
    prerequisites: ["Virtual Work and Constraints", "Basics of Variational Methods"],
    related: ["Hamilton's Principle", "Hamiltonian Equations"],
    typicalProblems: ["Pendulum systems with constraints", "Rolling systems in generalized coordinates", "Small oscillations from a Lagrangian"],
    keyFormulas: ["\\frac{d}{dt}\\frac{\\partial L}{\\partial \\dot q_j}-\\frac{\\partial L}{\\partial q_j}=Q_j^{(\\mathrm{nc})}", "L=T-V"],
    commonMisunderstandings: ["Equating generalized coordinates with Cartesian coordinates", "Forgetting velocity-dependent kinetic terms", "Ignoring nonconservative generalized forces"],
    studyOrder: 7,
    difficulty: "intermediate",
    tags: ["Lagrangian", "generalized coordinates", "constraints"],
  },
  {
    id: "hamilton-principle",
    course: "theoretical-mechanics",
    title: "Hamilton's Principle",
    alias: ["stationary action", "least action"],
    description:
      "Hamilton's principle states that the physical path makes the action stationary under admissible variations with fixed endpoints.",
    textbookStyleSummary:
      "The endpoint condition is part of the variational problem. The action principle unifies mechanics with field-theoretic and quantum formulations, but its use requires a well-defined Lagrangian and admissible paths.",
    prerequisites: ["Lagrange Equations", "Basics of Variational Methods"],
    related: ["Hamiltonian Equations", "Canonical Transformations and Poisson Brackets"],
    typicalProblems: ["Deriving Lagrange equations from the action", "Interpreting fixed-endpoint variations", "Finding conserved quantities from symmetries"],
    keyFormulas: ["S[q]=\\int_{t_1}^{t_2}L(q,\\dot q,t)\\,dt", "\\delta S=0"],
    commonMisunderstandings: ["Saying the action is always a minimum", "Not imposing fixed endpoints", "Applying the principle without identifying the admissible coordinate space"],
    studyOrder: 8,
    difficulty: "intermediate",
    tags: ["action", "variation", "symmetry"],
  },
  {
    id: "hamilton-equations",
    course: "theoretical-mechanics",
    title: "Hamiltonian Equations",
    alias: ["Hamiltonian mechanics", "canonical variables"],
    description:
      "Hamiltonian mechanics uses canonical coordinates and momenta to express dynamics as first-order equations in phase space.",
    textbookStyleSummary:
      "The Hamiltonian is obtained by a Legendre transform when velocities can be expressed in terms of canonical momenta. Canonical variables are not arbitrary coordinates; they preserve the symplectic structure.",
    prerequisites: ["Lagrange Equations"],
    related: ["Canonical Transformations and Poisson Brackets", "Central-Force Motion"],
    typicalProblems: ["Constructing canonical momenta and Hamiltonians", "Solving one-degree-of-freedom phase-space motion", "Identifying cyclic coordinates and conserved momenta"],
    keyFormulas: ["p_j=\\frac{\\partial L}{\\partial \\dot q_j}", "H=\\sum_j p_j\\dot q_j-L", "\\dot q_j=\\frac{\\partial H}{\\partial p_j},\\quad \\dot p_j=-\\frac{\\partial H}{\\partial q_j}"],
    commonMisunderstandings: ["Assuming the Hamiltonian always equals total energy", "Forgetting the Legendre-transform condition", "Using noncanonical variables in canonical equations"],
    studyOrder: 9,
    difficulty: "advanced",
    tags: ["phase space", "canonical variables", "Hamiltonian"],
  },
  {
    id: "canonical-transformations",
    course: "theoretical-mechanics",
    title: "Canonical Transformations and Poisson Brackets",
    alias: ["Poisson bracket", "generating function", "canonical transformation"],
    description:
      "Canonical transformations preserve the Hamiltonian structure and are diagnosed through Poisson brackets or generating functions.",
    textbookStyleSummary:
      "A transformation is canonical only if it preserves the fundamental Poisson brackets or symplectic form. Generating functions provide a constructive way to relate old and new canonical variables.",
    prerequisites: ["Hamiltonian Equations"],
    related: ["Hamilton's Principle", "Operators and Observables"],
    typicalProblems: ["Checking whether a transformation is canonical", "Using generating functions", "Computing Poisson brackets and constants of motion"],
    keyFormulas: ["\\{f,g\\}=\\sum_j\\left(\\frac{\\partial f}{\\partial q_j}\\frac{\\partial g}{\\partial p_j}-\\frac{\\partial f}{\\partial p_j}\\frac{\\partial g}{\\partial q_j}\\right)", "\\{Q_i,P_j\\}=\\delta_{ij}"],
    commonMisunderstandings: ["Treating any variable substitution as canonical", "Ignoring time-dependent generating functions", "Confusing Poisson brackets with ordinary commutators"],
    studyOrder: 10,
    difficulty: "advanced",
    tags: ["Poisson bracket", "canonical transformation", "symplectic structure"],
  },
  {
    id: "small-oscillations",
    course: "theoretical-mechanics",
    title: "Small Oscillations",
    alias: ["normal modes", "linearized motion"],
    description:
      "Small-oscillation theory linearizes motion near a stable equilibrium and diagonalizes coupled modes.",
    textbookStyleSummary:
      "Find the equilibrium first, expand kinetic and potential energies to quadratic order, and solve the generalized eigenvalue problem. Normal coordinates describe independent harmonic modes only within the linear approximation.",
    prerequisites: ["Lagrange Equations"],
    related: ["Oscillations, Waves, and Optics", "Special Functions"],
    typicalProblems: ["Coupled oscillator normal modes", "Small oscillations of constrained systems", "Stability analysis near equilibrium"],
    keyFormulas: ["\\sum_j (V_{ij}-\\omega^2 T_{ij})a_j=0"],
    commonMisunderstandings: ["Expanding around a point that is not equilibrium", "Keeping inconsistent orders of approximation", "Assuming normal modes remain independent beyond linear order"],
    studyOrder: 11,
    difficulty: "advanced",
    tags: ["normal modes", "linearization", "stability"],
  },
  {
    id: "electrostatics",
    course: "electrodynamics",
    title: "Electrostatics",
    alias: ["static electric field", "electric potential"],
    description:
      "Electrostatics studies time-independent electric fields produced by charges and described by potential theory.",
    textbookStyleSummary:
      "In electrostatics, the electric field is irrotational and can be written as the negative gradient of a scalar potential. Problems must distinguish free charge, bound charge, conductors, dielectrics, and chosen boundary data.",
    prerequisites: ["Electromagnetism Basics", "Vector Calculus Basics"],
    related: ["Electrostatic Boundary-Value Problems", "Multipole Expansion"],
    typicalProblems: ["Computing fields from charge distributions", "Using potentials for symmetric systems", "Energy of electrostatic configurations"],
    keyFormulas: ["\\nabla\\cdot\\mathbf{E}=\\frac{\\rho}{\\varepsilon_0}", "\\nabla\\times\\mathbf{E}=0", "\\mathbf{E}=-\\nabla\\phi"],
    commonMisunderstandings: ["Confusing electric field with electric displacement", "Using potential without specifying the reference", "Ignoring conductor equilibrium conditions"],
    studyOrder: 1,
    difficulty: "basic",
    tags: ["electric field", "potential", "static field"],
  },
  {
    id: "electrostatic-boundary-value",
    course: "electrodynamics",
    title: "Electrostatic Boundary-Value Problems",
    alias: ["Laplace equation", "Poisson equation", "uniqueness theorem", "静电边值问题", "边值问题", "唯一性定理"],
    description:
      "Electrostatic boundary-value problems determine potentials from Poisson or Laplace equations plus boundary conditions.",
    textbookStyleSummary:
      "State the region, sources, conductor or dielectric interfaces, and boundary conditions before solving. The uniqueness theorem justifies a constructed solution only after all boundary data and regularity conditions are checked.",
    prerequisites: ["Electrostatics", "Well-Posed Boundary-Value Problems"],
    related: ["Image Method", "Separation of Variables", "Green's Functions"],
    typicalProblems: ["Potential in a grounded conducting box", "Dielectric-interface boundary conditions", "Uniqueness checks for guessed potentials"],
    keyFormulas: ["\\nabla^2\\phi=-\\frac{\\rho}{\\varepsilon_0}", "\\phi|_{\\partial\\Omega}=f", "\\varepsilon_1 E_{1n}-\\varepsilon_2 E_{2n}=\\sigma_f"],
    commonMisunderstandings: ["Forgetting to specify the solution region", "Using uniqueness before verifying boundary conditions", "Mixing conductor and dielectric boundary conditions"],
    studyOrder: 2,
    difficulty: "intermediate",
    tags: ["Poisson equation", "boundary conditions", "uniqueness"],
  },
  {
    id: "image-method",
    course: "electrodynamics",
    title: "Image Method",
    alias: ["method of images", "image charges", "镜像法", "镜像电荷"],
    description:
      "The image method replaces a conductor boundary problem by fictitious sources outside the physical region.",
    textbookStyleSummary:
      "Image charges are not real charges. The method is valid when the constructed potential satisfies the correct equation in the physical region and all boundary conditions, after which uniqueness establishes the solution.",
    prerequisites: ["Electrostatic Boundary-Value Problems"],
    related: ["Green's Functions", "Multipole Expansion"],
    typicalProblems: ["Point charge near a grounded plane", "Charge outside a grounded conducting sphere", "Force and induced charge from image solutions"],
    keyFormulas: ["\\phi(\\mathbf{r})=\\frac{1}{4\\pi\\varepsilon_0}\\sum_i\\frac{q_i}{|\\mathbf{r}-\\mathbf{r}_i|}"],
    commonMisunderstandings: ["Treating image charges as physically present", "Placing images inside the solution region", "Forgetting to check behavior at infinity"],
    studyOrder: 3,
    difficulty: "intermediate",
    tags: ["image charge", "conductor", "uniqueness"],
  },
  {
    id: "multipole-expansion",
    course: "electrodynamics",
    title: "Multipole Expansion",
    alias: ["dipole expansion", "far-field approximation"],
    description:
      "Multipole expansion expresses the far-field potential of a localized charge distribution as monopole, dipole, quadrupole, and higher terms.",
    textbookStyleSummary:
      "The expansion assumes the observation point is far from the source region. Coordinate origin choice affects lower multipole moments when the total charge is nonzero, so the approximation and origin must be stated.",
    prerequisites: ["Electrostatics", "Special Functions"],
    related: ["Electrostatic Boundary-Value Problems", "Electromagnetic Radiation"],
    typicalProblems: ["Far-field potential of localized charges", "Dipole field calculations", "Identifying the leading nonzero multipole"],
    keyFormulas: ["\\phi(\\mathbf{r})=\\frac{1}{4\\pi\\varepsilon_0}\\left(\\frac{Q}{r}+\\frac{\\mathbf{p}\\cdot\\hat{\\mathbf{r}}}{r^2}+\\cdots\\right)"],
    commonMisunderstandings: ["Using the far-field expansion near the source", "Ignoring origin dependence", "Keeping inconsistent orders in the expansion"],
    studyOrder: 4,
    difficulty: "intermediate",
    tags: ["dipole", "far field", "Legendre expansion"],
  },
  {
    id: "magnetostatics",
    course: "electrodynamics",
    title: "Magnetostatics",
    alias: ["steady currents", "magnetic field"],
    description:
      "Magnetostatics studies time-independent magnetic fields generated by steady currents and magnetized matter.",
    textbookStyleSummary:
      "Magnetostatic problems require distinguishing magnetic induction, magnetic field intensity, free current, bound current, and material response. Symmetry determines whether Ampere's law directly solves the field.",
    prerequisites: ["Electromagnetism Basics"],
    related: ["Maxwell Equations", "Potentials and Gauge Transformations"],
    typicalProblems: ["Fields of long wires and solenoids", "Vector potential of steady currents", "Boundary conditions at magnetic material interfaces"],
    keyFormulas: ["\\nabla\\cdot\\mathbf{B}=0", "\\nabla\\times\\mathbf{H}=\\mathbf{J}_f", "\\mathbf{B}=\\nabla\\times\\mathbf{A}"],
    commonMisunderstandings: ["Confusing B and H", "Ignoring bound currents in matter", "Applying Ampere's law without enough symmetry"],
    studyOrder: 5,
    difficulty: "intermediate",
    tags: ["B field", "H field", "steady current"],
  },
  {
    id: "maxwell-equations",
    course: "electrodynamics",
    title: "Maxwell Equations",
    alias: ["field equations", "macroscopic Maxwell equations", "Maxwell 方程组", "麦克斯韦方程组"],
    description:
      "Maxwell equations relate electric and magnetic fields to charges and currents and unify electrostatics, magnetostatics, and time-dependent fields.",
    textbookStyleSummary:
      "Choose microscopic or macroscopic variables consistently. In materials, distinguish E, D, B, H, free charge, bound charge, free current, and bound current.",
    prerequisites: ["Electrostatics", "Magnetostatics"],
    related: ["Electromagnetic Waves", "Potentials and Gauge Transformations"],
    typicalProblems: ["Deriving continuity equations", "Boundary conditions from integral forms", "Wave equations in vacuum or media"],
    keyFormulas: [
      "\\nabla\\cdot\\mathbf{D}=\\rho_f",
      "\\nabla\\cdot\\mathbf{B}=0",
      "\\nabla\\times\\mathbf{E}=-\\frac{\\partial\\mathbf{B}}{\\partial t}",
      "\\nabla\\times\\mathbf{H}=\\mathbf{J}_f+\\frac{\\partial\\mathbf{D}}{\\partial t}",
    ],
    commonMisunderstandings: ["Mixing microscopic and macroscopic forms", "Dropping displacement current in time-dependent problems", "Confusing boundary conditions for normal and tangential components"],
    studyOrder: 6,
    difficulty: "intermediate",
    tags: ["Maxwell equations", "fields", "materials"],
  },
  {
    id: "electromagnetic-waves",
    course: "electrodynamics",
    title: "Electromagnetic Waves",
    alias: ["plane waves", "wave propagation", "polarization"],
    description:
      "Electromagnetic waves arise from Maxwell equations in vacuum or media and carry energy and momentum.",
    textbookStyleSummary:
      "A wave problem should state the medium, propagation direction, polarization, boundary, and frequency regime. Boundary conditions determine reflection, transmission, and allowed modes.",
    prerequisites: ["Maxwell Equations"],
    related: ["Potentials and Gauge Transformations", "Electromagnetic Radiation"],
    typicalProblems: ["Plane-wave solutions in vacuum", "Reflection and transmission at interfaces", "Waveguides and resonant cavities"],
    keyFormulas: ["\\nabla^2\\mathbf{E}-\\mu\\varepsilon\\frac{\\partial^2\\mathbf{E}}{\\partial t^2}=0", "\\mathbf{S}=\\mathbf{E}\\times\\mathbf{H}"],
    commonMisunderstandings: ["Ignoring polarization", "Forgetting material dispersion assumptions", "Applying normal-incidence formulas to oblique incidence"],
    studyOrder: 7,
    difficulty: "intermediate",
    tags: ["wave equation", "polarization", "Poynting vector"],
  },
  {
    id: "potentials-gauge",
    course: "electrodynamics",
    title: "Potentials and Gauge Transformations",
    alias: ["scalar potential", "vector potential", "Lorenz gauge", "Coulomb gauge"],
    description:
      "Electromagnetic potentials express fields through scalar and vector potentials and introduce gauge freedom.",
    textbookStyleSummary:
      "The same fields can be represented by different potentials connected by a gauge transformation. Coulomb gauge separates transverse and longitudinal structure, while Lorenz gauge preserves relativistic covariance.",
    prerequisites: ["Maxwell Equations", "Magnetostatics"],
    related: ["Electromagnetic Waves", "Relativistic Electrodynamics"],
    typicalProblems: ["Deriving fields from potentials", "Applying Coulomb or Lorenz gauge", "Retarded potentials for time-dependent sources"],
    keyFormulas: ["\\mathbf{B}=\\nabla\\times\\mathbf{A}", "\\mathbf{E}=-\\nabla\\phi-\\frac{\\partial\\mathbf{A}}{\\partial t}", "\\mathbf{A}'=\\mathbf{A}+\\nabla\\chi,\\quad \\phi'=\\phi-\\frac{\\partial\\chi}{\\partial t}"],
    commonMisunderstandings: ["Treating gauge choice as a change in physical fields", "Confusing Lorenz and Coulomb gauges", "Ignoring boundary conditions on potentials"],
    studyOrder: 8,
    difficulty: "advanced",
    tags: ["potential", "gauge", "retarded fields"],
  },
  {
    id: "electromagnetic-radiation",
    course: "electrodynamics",
    title: "Electromagnetic Radiation",
    alias: ["retarded potentials", "dipole radiation"],
    description:
      "Radiation theory describes fields produced by time-dependent sources in the far zone and the energy carried away by waves.",
    textbookStyleSummary:
      "Radiation fields are identified by their far-field behavior and transverse structure. Retarded time, multipole order, and source acceleration determine the leading radiation term.",
    prerequisites: ["Potentials and Gauge Transformations", "Multipole Expansion"],
    related: ["Electromagnetic Waves", "Relativistic Electrodynamics"],
    typicalProblems: ["Electric dipole radiation", "Radiated power calculations", "Far-zone approximation and angular distribution"],
    keyFormulas: ["P=\\frac{\\mu_0}{6\\pi c}|\\ddot{\\mathbf{p}}|^2"],
    commonMisunderstandings: ["Calling every time-dependent field radiation", "Ignoring near-field terms", "Forgetting retarded time"],
    studyOrder: 9,
    difficulty: "advanced",
    tags: ["radiation", "far field", "retarded time"],
  },
  {
    id: "relativistic-electrodynamics",
    course: "electrodynamics",
    title: "Relativistic Electrodynamics",
    alias: ["covariant electrodynamics", "field tensor"],
    description:
      "Relativistic electrodynamics expresses Maxwell theory in a Lorentz-covariant form and relates electric and magnetic fields between inertial frames.",
    textbookStyleSummary:
      "Fields are components of the electromagnetic field tensor rather than independent absolute vectors. Lorentz transformations mix electric and magnetic fields while preserving invariant combinations.",
    prerequisites: ["Maxwell Equations", "Potentials and Gauge Transformations"],
    related: ["Electromagnetic Radiation"],
    typicalProblems: ["Transforming fields between inertial frames", "Using four-potential notation", "Identifying electromagnetic invariants"],
    keyFormulas: ["F^{\\mu\\nu}=\\partial^\\mu A^\\nu-\\partial^\\nu A^\\mu", "\\partial_\\mu F^{\\mu\\nu}=\\mu_0 J^\\nu"],
    commonMisunderstandings: ["Transforming E and B as ordinary vectors", "Ignoring sign conventions in the metric", "Confusing gauge covariance with Lorentz covariance"],
    studyOrder: 10,
    difficulty: "advanced",
    tags: ["Lorentz covariance", "field tensor", "four-potential"],
  },
  {
    id: "wave-function-state-vector",
    course: "quantum-mechanics",
    title: "Wave Function and State Vector",
    alias: ["quantum state", "Hilbert space", "probability amplitude"],
    description:
      "Quantum states are vectors in Hilbert space; wave functions are coordinate-representation amplitudes of those states.",
    textbookStyleSummary:
      "A wave function is not itself a classical wave in space. It must be normalized, belong to the physical domain of the relevant operators, and be interpreted through probabilities and expectation values.",
    prerequisites: ["Linear Algebra", "Complex Functions"],
    related: ["Schrodinger Equation", "Representations"],
    typicalProblems: ["Normalizing a wave function", "Computing expectation values", "Changing between state-vector and wave-function language"],
    keyFormulas: ["\\int |\\psi(x)|^2\\,dx=1", "\\langle A\\rangle=\\langle \\psi|\\hat A|\\psi\\rangle"],
    commonMisunderstandings: ["Equating the wave function with a particle trajectory", "Forgetting normalization", "Confusing a state with one of its representations"],
    studyOrder: 1,
    difficulty: "basic",
    tags: ["state vector", "wave function", "normalization"],
  },
  {
    id: "schrodinger-equation",
    course: "quantum-mechanics",
    title: "Schrodinger Equation",
    alias: ["time-dependent Schrodinger equation", "Hamiltonian operator"],
    description:
      "The Schrodinger equation governs quantum-state evolution through the Hamiltonian operator.",
    textbookStyleSummary:
      "The Hamiltonian encodes the physical system, boundary conditions define the allowed domain, and the time-dependent equation preserves normalization for self-adjoint Hamiltonians.",
    prerequisites: ["Wave Function and State Vector"],
    related: ["One-Dimensional Stationary States", "Operators and Observables"],
    typicalProblems: ["Solving time evolution for stationary expansions", "Separating time and space dependence", "Checking boundary and normalization conditions"],
    keyFormulas: ["i\\hbar\\frac{\\partial}{\\partial t}|\\psi(t)\\rangle=\\hat H|\\psi(t)\\rangle", "\\hat H\\psi=E\\psi"],
    commonMisunderstandings: ["Treating every mathematical solution as physically allowed", "Ignoring operator domains", "Forgetting boundary conditions in energy quantization"],
    studyOrder: 2,
    difficulty: "basic",
    tags: ["Hamiltonian", "time evolution", "eigenvalue equation"],
  },
  {
    id: "one-dimensional-stationary",
    course: "quantum-mechanics",
    title: "One-Dimensional Stationary States",
    alias: [
      "bound states",
      "potential wells",
      "stationary Schrodinger equation",
      "one-dimensional stationary",
      "one-dimensional stationary state",
      "one-dimensional stationary states",
      "one-dimensional stationary-state",
      "一维定态问题",
      "束缚态",
    ],
    description:
      "One-dimensional stationary-state problems determine allowed energies and wave functions from the potential and boundary conditions.",
    textbookStyleSummary:
      "Solve piecewise in regions where the potential has a simple form, then impose continuity, boundary, normalizability, and physical-domain conditions. Discreteness usually comes from boundary or square-integrability requirements.",
    prerequisites: ["Schrodinger Equation"],
    related: ["Quantum Harmonic Oscillator", "Perturbation Theory"],
    typicalProblems: ["Infinite and finite square wells", "Potential steps and barriers", "Bound-state transcendental equations"],
    keyFormulas: ["-\\frac{\\hbar^2}{2m}\\frac{d^2\\psi}{dx^2}+V(x)\\psi=E\\psi"],
    commonMisunderstandings: ["Ignoring continuity of the derivative where the potential is finite", "Forgetting square integrability", "Calling every formal solution an allowed state"],
    studyOrder: 3,
    difficulty: "intermediate",
    tags: ["bound state", "boundary condition", "quantization"],
  },
  {
    id: "harmonic-oscillator",
    course: "quantum-mechanics",
    title: "Quantum Harmonic Oscillator",
    alias: ["creation and annihilation operators", "ladder operators", "谐振子", "升降算符"],
    description:
      "The quantum harmonic oscillator is a solvable model with equally spaced energy levels and ladder-operator structure.",
    textbookStyleSummary:
      "The algebraic solution uses factorization of the Hamiltonian and the positivity of number-operator eigenvalues. The coordinate solution leads to Hermite functions and normalizability conditions.",
    prerequisites: ["Operators and Observables", "One-Dimensional Stationary States"],
    related: ["Angular Momentum", "Special Functions"],
    typicalProblems: ["Deriving energy levels with ladder operators", "Computing matrix elements", "Finding expectation values in oscillator states"],
    keyFormulas: ["\\hat H=\\hbar\\omega\\left(\\hat a^\\dagger\\hat a+\\frac12\\right)", "E_n=\\hbar\\omega\\left(n+\\frac12\\right)"],
    commonMisunderstandings: ["Forgetting the zero-point energy", "Confusing ladder operators with ordinary numbers", "Ignoring normalization of excited states"],
    studyOrder: 4,
    difficulty: "intermediate",
    tags: ["ladder operators", "zero-point energy", "Hermite functions"],
  },
  {
    id: "operators-observables",
    course: "quantum-mechanics",
    title: "Operators and Observables",
    alias: ["Hermitian operators", "measurement", "commutators"],
    description:
      "Physical observables are represented by self-adjoint operators whose eigenvalues are possible measurement outcomes.",
    textbookStyleSummary:
      "Operator domains, self-adjointness, eigenstates, spectra, and commutators all matter. Measurement statements require distinguishing the state before measurement from the post-measurement state.",
    prerequisites: ["Wave Function and State Vector", "Linear Algebra"],
    related: ["Representations", "Angular Momentum"],
    typicalProblems: ["Checking Hermiticity", "Computing commutators", "Expanding a state in an eigenbasis"],
    keyFormulas: ["[\\hat x,\\hat p]=i\\hbar", "\\Delta A\\Delta B\\ge \\frac12|\\langle[\\hat A,\\hat B]\\rangle|"],
    commonMisunderstandings: ["Treating Hermitian and self-adjoint as always interchangeable", "Confusing expectation value with measurement outcome", "Ignoring degeneracy in measurement"],
    studyOrder: 5,
    difficulty: "intermediate",
    tags: ["operator", "observable", "commutator"],
  },
  {
    id: "representations",
    course: "quantum-mechanics",
    title: "Representations",
    alias: ["position representation", "momentum representation", "basis change"],
    description:
      "Representations express the same state and operators in different bases, such as position, momentum, or energy eigenbases.",
    textbookStyleSummary:
      "A representation is a choice of basis, not a different physical state. Transformations between representations preserve inner products and physical predictions.",
    prerequisites: ["Wave Function and State Vector", "Operators and Observables"],
    related: ["Angular Momentum", "Perturbation Theory"],
    typicalProblems: ["Changing between position and momentum wave functions", "Matrix representation of operators", "Using completeness relations"],
    keyFormulas: ["\\psi(x)=\\langle x|\\psi\\rangle", "\\phi(p)=\\langle p|\\psi\\rangle", "\\int |x\\rangle\\langle x|\\,dx=\\hat I"],
    commonMisunderstandings: ["Treating representation changes as physical changes", "Forgetting normalization factors in Fourier transforms", "Mixing basis vectors with components"],
    studyOrder: 6,
    difficulty: "intermediate",
    tags: ["basis", "representation", "completeness"],
  },
  {
    id: "central-force",
    course: "quantum-mechanics",
    title: "Central Potentials",
    alias: ["hydrogen-like atom", "radial equation"],
    description:
      "Central-potential problems separate angular and radial dependence using angular momentum eigenfunctions.",
    textbookStyleSummary:
      "Spherical symmetry makes angular momentum a conserved quantity. The radial equation includes an effective centrifugal term, and physical solutions require regularity at the origin and normalizability at infinity.",
    prerequisites: ["Angular Momentum", "One-Dimensional Stationary States"],
    related: ["Special Functions", "Perturbation Theory"],
    typicalProblems: ["Hydrogen radial equation", "Degeneracy of central potentials", "Selection of physical radial solutions"],
    keyFormulas: ["\\psi(r,\\theta,\\phi)=R_{n\\ell}(r)Y_{\\ell m}(\\theta,\\phi)"],
    commonMisunderstandings: ["Ignoring regularity at the origin", "Confusing radial wave function with reduced radial function", "Missing degeneracy labels"],
    studyOrder: 7,
    difficulty: "advanced",
    tags: ["central potential", "spherical harmonics", "radial equation"],
  },
  {
    id: "angular-momentum",
    course: "quantum-mechanics",
    title: "Angular Momentum",
    alias: ["orbital angular momentum", "spin algebra"],
    description:
      "Angular momentum is described by noncommuting operators with quantized eigenvalues and ladder-operator structure.",
    textbookStyleSummary:
      "The simultaneous eigenstates of \\(\\hat L^2\\) and \\(\\hat L_z\\) are constrained by commutation relations and ladder operations. Addition of angular momenta requires Clebsch-Gordan structure.",
    prerequisites: ["Operators and Observables"],
    related: ["Spin", "Central Potentials"],
    typicalProblems: ["Using ladder operators", "Finding allowed quantum numbers", "Adding two angular momenta"],
    keyFormulas: ["[\\hat L_i,\\hat L_j]=i\\hbar\\epsilon_{ijk}\\hat L_k", "\\hat L^2|\\ell m\\rangle=\\hbar^2\\ell(\\ell+1)|\\ell m\\rangle"],
    commonMisunderstandings: ["Assuming all components can have definite values simultaneously", "Forgetting bounds on m", "Mixing orbital and spin angular momentum without stating the space"],
    studyOrder: 8,
    difficulty: "advanced",
    tags: ["commutator", "ladder operator", "quantum number"],
  },
  {
    id: "spin",
    course: "quantum-mechanics",
    title: "Spin",
    alias: ["spin one-half", "Pauli matrices"],
    description:
      "Spin is intrinsic angular momentum represented in finite-dimensional state spaces and measured through spin components.",
    textbookStyleSummary:
      "Spin states are not spatial rotations of a classical spinning object. For spin one-half systems, Pauli matrices generate the algebra and measurement probabilities follow from projections onto the measurement basis.",
    prerequisites: ["Angular Momentum"],
    related: ["Identical Particles", "Representations"],
    typicalProblems: ["Spin measurement along different axes", "Pauli-matrix expectation values", "Two-spin addition"],
    keyFormulas: ["\\hat S_i=\\frac{\\hbar}{2}\\sigma_i", "\\sigma_i\\sigma_j=\\delta_{ij}I+i\\epsilon_{ijk}\\sigma_k"],
    commonMisunderstandings: ["Interpreting spin as literal rotation of a small sphere", "Confusing basis states for different measurement axes", "Ignoring normalization of spinors"],
    studyOrder: 9,
    difficulty: "intermediate",
    tags: ["spinor", "Pauli matrices", "measurement"],
  },
  {
    id: "identical-particles",
    course: "quantum-mechanics",
    title: "Identical Particles",
    alias: ["symmetrization", "fermions", "bosons"],
    description:
      "Identical-particle states must be symmetric for bosons and antisymmetric for fermions under particle exchange.",
    textbookStyleSummary:
      "Exchange symmetry is a property of the total state, including spatial and spin parts. The Pauli principle follows from antisymmetry for identical fermions.",
    prerequisites: ["Spin", "Representations"],
    related: ["Quantum Statistics", "Fermi-Dirac Statistics", "Bose-Einstein Statistics"],
    typicalProblems: ["Constructing symmetric and antisymmetric two-particle states", "Counting allowed spin-spatial combinations", "Applying the Pauli exclusion principle"],
    keyFormulas: ["\\Psi(1,2)=\\pm\\Psi(2,1)"],
    commonMisunderstandings: ["Symmetrizing only the spatial part", "Applying exchange symmetry to distinguishable particles", "Forgetting spin degeneracy in counting"],
    studyOrder: 10,
    difficulty: "advanced",
    tags: ["exchange symmetry", "bosons", "fermions"],
  },
  {
    id: "perturbation-theory",
    course: "quantum-mechanics",
    title: "Perturbation Theory",
    alias: ["stationary perturbation", "degenerate perturbation", "variational method"],
    description:
      "Perturbation theory approximates spectra and states when the Hamiltonian differs slightly from a solvable problem.",
    textbookStyleSummary:
      "Nondegenerate and degenerate perturbation theory have different procedures. A small parameter, unperturbed basis, normalization convention, and degeneracy structure must be specified.",
    prerequisites: ["Operators and Observables", "Representations"],
    related: ["Quantum Harmonic Oscillator", "Central Potentials"],
    typicalProblems: ["First-order energy shifts", "Degenerate-level splitting", "Variational estimates for ground-state energy"],
    keyFormulas: ["E_n^{(1)}=\\langle n^{(0)}|\\hat V|n^{(0)}\\rangle"],
    commonMisunderstandings: ["Using nondegenerate formulas for degenerate levels", "Forgetting to normalize corrected states", "Ignoring the smallness condition"],
    studyOrder: 11,
    difficulty: "advanced",
    tags: ["small parameter", "energy shift", "degeneracy"],
  },
  {
    id: "scattering-theory",
    course: "quantum-mechanics",
    title: "Scattering Theory",
    alias: ["Born approximation", "partial waves"],
    description:
      "Scattering theory connects asymptotic wave behavior with cross sections and interaction potentials.",
    textbookStyleSummary:
      "A scattering problem must define the incident state, interaction potential, asymptotic boundary condition, and observable cross section. The Born approximation and partial-wave method apply in different regimes.",
    prerequisites: ["One-Dimensional Stationary States", "Central Potentials"],
    related: ["Green's Functions", "Perturbation Theory"],
    typicalProblems: ["One-dimensional reflection and transmission", "Born approximation cross sections", "Partial-wave phase shifts"],
    keyFormulas: ["\\frac{d\\sigma}{d\\Omega}=|f(\\theta,\\phi)|^2"],
    commonMisunderstandings: ["Confusing probability amplitude with probability current", "Ignoring asymptotic boundary conditions", "Using the Born approximation outside its validity regime"],
    studyOrder: 12,
    difficulty: "advanced",
    tags: ["cross section", "asymptotic state", "phase shift"],
  },
  {
    id: "thermodynamic-laws",
    course: "thermo-stat",
    title: "Thermodynamic Laws",
    alias: ["first law", "second law", "entropy"],
    description:
      "Thermodynamic laws organize macroscopic energy, entropy, temperature, and equilibrium relations independent of microscopic details.",
    textbookStyleSummary:
      "State variables and process variables must be distinguished. Entropy changes can be computed through reversible paths even when the actual process is irreversible, but the physical interpretation requires care.",
    prerequisites: ["Thermal Processes and Ideal Gases"],
    related: ["Thermodynamic Potentials", "Maxwell Relations"],
    typicalProblems: ["Entropy changes in ideal-gas processes", "Heat-engine efficiency", "Clausius inequality applications"],
    keyFormulas: ["dU=TdS-pdV+\\mu dN", "dS\\ge \\frac{\\delta Q}{T}"],
    commonMisunderstandings: ["Treating heat as a state function", "Assuming entropy never decreases for a subsystem", "Using reversible formulas without constructing a reversible path"],
    studyOrder: 1,
    difficulty: "basic",
    tags: ["entropy", "energy", "equilibrium"],
  },
  {
    id: "thermodynamic-properties",
    course: "thermo-stat",
    title: "Thermodynamic Properties of Uniform Matter",
    alias: ["equation of state", "response functions"],
    description:
      "Uniform matter is characterized by equations of state and response functions such as heat capacities, compressibility, and expansion coefficient.",
    textbookStyleSummary:
      "Thermodynamic derivatives depend on which variables are held fixed. Response functions should be derived from a consistent equation of state or thermodynamic potential.",
    prerequisites: ["Thermodynamic Laws"],
    related: ["Thermodynamic Potentials", "Maxwell Relations"],
    typicalProblems: ["Relating heat capacities", "Using equations of state", "Computing compressibility and expansion coefficients"],
    keyFormulas: ["C_V=T\\left(\\frac{\\partial S}{\\partial T}\\right)_V", "\\kappa_T=-\\frac1V\\left(\\frac{\\partial V}{\\partial p}\\right)_T"],
    commonMisunderstandings: ["Forgetting fixed-variable subscripts", "Mixing intensive and extensive variables", "Using ideal-gas identities for nonideal systems"],
    studyOrder: 2,
    difficulty: "intermediate",
    tags: ["equation of state", "heat capacity", "response"],
  },
  {
    id: "thermodynamic-potentials",
    course: "thermo-stat",
    title: "Thermodynamic Potentials",
    alias: ["Helmholtz free energy", "Gibbs free energy", "enthalpy"],
    description:
      "Thermodynamic potentials are Legendre transforms of internal energy chosen for different natural variables and constraints.",
    textbookStyleSummary:
      "Use the potential whose natural variables match the externally controlled conditions. Helmholtz free energy is natural for fixed temperature and volume, while Gibbs free energy is natural for fixed temperature and pressure.",
    prerequisites: ["Thermodynamic Laws"],
    related: ["Maxwell Relations", "Phase Equilibrium"],
    typicalProblems: ["Choosing the correct potential for equilibrium", "Legendre-transform derivations", "Deriving thermodynamic identities"],
    keyFormulas: ["F=U-TS", "G=U-TS+pV", "dG=-S\\,dT+V\\,dp+\\mu\\,dN"],
    commonMisunderstandings: ["Choosing a potential without checking natural variables", "Confusing Helmholtz and Gibbs free energies", "Ignoring chemical-potential terms"],
    studyOrder: 3,
    difficulty: "intermediate",
    tags: ["natural variables", "free energy", "Legendre transform"],
  },
  {
    id: "maxwell-relations",
    course: "thermo-stat",
    title: "Maxwell Relations",
    alias: ["thermodynamic identities", "mixed derivatives"],
    description:
      "Maxwell relations follow from equality of mixed partial derivatives of thermodynamic potentials.",
    textbookStyleSummary:
      "The sign and variables of each Maxwell relation depend on the differential form of the chosen potential. Always identify the natural variables before differentiating.",
    prerequisites: ["Thermodynamic Potentials"],
    related: ["Thermodynamic Properties of Uniform Matter", "Phase Equilibrium"],
    typicalProblems: ["Deriving Maxwell relations", "Converting hard-to-measure derivatives", "Computing entropy changes from equations of state"],
    keyFormulas: ["\\left(\\frac{\\partial S}{\\partial V}\\right)_T=\\left(\\frac{\\partial p}{\\partial T}\\right)_V", "\\left(\\frac{\\partial S}{\\partial p}\\right)_T=-\\left(\\frac{\\partial V}{\\partial T}\\right)_p"],
    commonMisunderstandings: ["Dropping minus signs", "Using the wrong natural variables", "Treating all partial derivatives as interchangeable"],
    studyOrder: 4,
    difficulty: "intermediate",
    tags: ["partial derivative", "identity", "natural variables"],
  },
  {
    id: "phase-equilibrium",
    course: "thermo-stat",
    title: "Phase Equilibrium",
    alias: ["chemical potential", "Clapeyron equation"],
    description:
      "Phase equilibrium is determined by equality of temperature, pressure, and chemical potential for coexisting phases.",
    textbookStyleSummary:
      "At fixed temperature and pressure, Gibbs free energy determines equilibrium. Phase coexistence conditions lead to the Clapeyron equation and phase-boundary slopes.",
    prerequisites: ["Thermodynamic Potentials"],
    related: ["Maxwell Relations", "Fluctuations"],
    typicalProblems: ["Deriving phase coexistence conditions", "Using the Clapeyron equation", "Analyzing first-order phase transitions"],
    keyFormulas: ["\\mu_\\alpha(T,p)=\\mu_\\beta(T,p)", "\\frac{dp}{dT}=\\frac{L}{T\\Delta v}"],
    commonMisunderstandings: ["Using Helmholtz free energy under fixed pressure without transformation", "Ignoring chemical potential", "Confusing latent heat with heat capacity"],
    studyOrder: 5,
    difficulty: "advanced",
    tags: ["phase boundary", "chemical potential", "coexistence"],
  },
  {
    id: "statistical-postulates",
    course: "thermo-stat",
    title: "Statistical Postulates",
    alias: ["equal a priori probability", "phase space", "microstate"],
    description:
      "Statistical physics relates macroscopic thermodynamics to counting microstates and probabilities over phase space.",
    textbookStyleSummary:
      "The bridge from mechanics to thermodynamics requires defining microstates, macrostates, constraints, and probability postulates. Entropy measures the logarithm of accessible microstates in equilibrium.",
    prerequisites: ["Thermodynamic Laws"],
    related: ["Microcanonical Ensemble", "Canonical Ensemble"],
    typicalProblems: ["Counting microstates under constraints", "Computing entropy from multiplicity", "Distinguishing microstates and macrostates"],
    keyFormulas: ["S=k_B\\ln\\Omega"],
    commonMisunderstandings: ["Equating a macrostate with a single microstate", "Ignoring constraints in counting", "Applying equal probability outside the defined ensemble"],
    studyOrder: 6,
    difficulty: "intermediate",
    tags: ["microstate", "entropy", "probability"],
  },
  {
    id: "microcanonical-ensemble",
    course: "thermo-stat",
    title: "Microcanonical Ensemble",
    alias: ["isolated system", "fixed energy ensemble"],
    description:
      "The microcanonical ensemble describes an isolated system with fixed energy, volume, and particle number.",
    textbookStyleSummary:
      "The microcanonical distribution is uniform over accessible states in a narrow energy shell. Temperature and pressure emerge from entropy derivatives with respect to energy and volume.",
    prerequisites: ["Statistical Postulates"],
    related: ["Canonical Ensemble", "Grand Canonical Ensemble"],
    typicalProblems: ["Entropy of an isolated ideal gas", "Deriving temperature from state counting", "Comparing ensemble predictions in the thermodynamic limit"],
    keyFormulas: ["\\frac1T=\\left(\\frac{\\partial S}{\\partial U}\\right)_{V,N}"],
    commonMisunderstandings: ["Using a canonical Boltzmann factor in an isolated system", "Forgetting the energy-shell constraint", "Confusing ensemble averages with time averages without assumptions"],
    studyOrder: 7,
    difficulty: "intermediate",
    tags: ["isolated system", "entropy derivative", "energy shell"],
  },
  {
    id: "canonical-ensemble",
    course: "thermo-stat",
    title: "Canonical Ensemble",
    alias: ["Boltzmann distribution", "partition function"],
    description:
      "The canonical ensemble describes a system in thermal contact with a heat reservoir at fixed temperature.",
    textbookStyleSummary:
      "The partition function normalizes the Boltzmann distribution and generates thermodynamic quantities. The temperature is fixed by the reservoir rather than by a fixed system energy.",
    prerequisites: ["Microcanonical Ensemble"],
    related: ["Classical Statistics", "Quantum Statistics"],
    typicalProblems: ["Computing partition functions", "Deriving internal energy and heat capacity", "Analyzing two-level systems and harmonic oscillators"],
    keyFormulas: ["Z=\\sum_i e^{-\\beta E_i}", "F=-k_BT\\ln Z", "\\langle E\\rangle=-\\frac{\\partial}{\\partial\\beta}\\ln Z"],
    commonMisunderstandings: ["Confusing fixed temperature with fixed energy", "Forgetting degeneracy factors", "Using an unnormalized probability distribution"],
    studyOrder: 8,
    difficulty: "intermediate",
    tags: ["partition function", "Boltzmann factor", "thermal reservoir"],
  },
  {
    id: "grand-canonical-ensemble",
    course: "thermo-stat",
    title: "Grand Canonical Ensemble",
    alias: ["chemical potential ensemble", "variable particle number"],
    description:
      "The grand canonical ensemble describes systems exchanging both energy and particles with a reservoir.",
    textbookStyleSummary:
      "The chemical potential controls mean particle number. The grand partition function is appropriate for quantum gases, adsorption, and systems where particle number fluctuates.",
    prerequisites: ["Canonical Ensemble"],
    related: ["Quantum Statistics", "Bose-Einstein Statistics", "Fermi-Dirac Statistics"],
    typicalProblems: ["Grand partition functions", "Mean particle number and fluctuations", "Ideal quantum gas distributions"],
    keyFormulas: ["\\Xi=\\sum_N\\sum_s e^{-\\beta(E_{Ns}-\\mu N)}", "\\Omega=-k_BT\\ln\\Xi"],
    commonMisunderstandings: ["Treating chemical potential as arbitrary without constraints", "Forgetting particle-number fluctuations", "Using canonical formulas for variable-N systems"],
    studyOrder: 9,
    difficulty: "advanced",
    tags: ["chemical potential", "grand partition function", "fluctuation"],
  },
  {
    id: "classical-statistics",
    course: "thermo-stat",
    title: "Classical Statistics",
    alias: ["Maxwell-Boltzmann distribution", "classical ideal gas"],
    description:
      "Classical statistics describes dilute systems where quantum exchange effects can be neglected.",
    textbookStyleSummary:
      "The classical limit requires low phase-space density. Correct counting includes the Gibbs factor for indistinguishable particles and leads to the Maxwell-Boltzmann distribution.",
    prerequisites: ["Canonical Ensemble"],
    related: ["Quantum Statistics", "Fluctuations"],
    typicalProblems: ["Maxwell speed distribution", "Classical ideal-gas partition function", "Equipartition theorem applications"],
    keyFormulas: ["f(\\mathbf{p})\\propto e^{-\\beta p^2/(2m)}", "\\lambda_T=\\frac{h}{\\sqrt{2\\pi mk_BT}}"],
    commonMisunderstandings: ["Ignoring indistinguishability in entropy", "Using classical statistics at high density or low temperature", "Misapplying equipartition to frozen quantum modes"],
    studyOrder: 10,
    difficulty: "intermediate",
    tags: ["Maxwell-Boltzmann", "ideal gas", "classical limit"],
  },
  {
    id: "quantum-statistics",
    course: "thermo-stat",
    title: "Quantum Statistics",
    alias: ["Bose-Einstein statistics", "Fermi-Dirac statistics"],
    description:
      "Quantum statistics accounts for indistinguishability and exchange symmetry in many-particle systems.",
    textbookStyleSummary:
      "Bosons and fermions obey different occupation rules because of exchange symmetry. The correct distribution depends on particle type, conserved particle number, temperature, and chemical potential.",
    prerequisites: ["Grand Canonical Ensemble", "Identical Particles"],
    related: ["Bose-Einstein Statistics", "Fermi-Dirac Statistics"],
    typicalProblems: ["Deriving quantum occupation numbers", "Comparing classical and quantum limits", "Analyzing degenerate quantum gases"],
    keyFormulas: ["\\bar n_i=\\frac{1}{e^{\\beta(\\epsilon_i-\\mu)}\\mp1}"],
    commonMisunderstandings: ["Using Boltzmann statistics without checking the classical limit", "Mixing boson and fermion signs", "Ignoring degeneracy of single-particle levels"],
    studyOrder: 11,
    difficulty: "advanced",
    tags: ["bosons", "fermions", "occupation number"],
  },
  {
    id: "fluctuations",
    course: "thermo-stat",
    title: "Fluctuations",
    alias: ["thermal fluctuations", "response and variance"],
    description:
      "Fluctuation theory relates equilibrium variances to response functions and becomes especially important for small systems or near critical points.",
    textbookStyleSummary:
      "Fluctuations are not errors; they are statistical properties of equilibrium ensembles. Their size is controlled by thermodynamic stability and response coefficients.",
    prerequisites: ["Canonical Ensemble", "Grand Canonical Ensemble"],
    related: ["Phase Equilibrium", "Green's Functions"],
    typicalProblems: ["Energy fluctuations in the canonical ensemble", "Particle-number fluctuations in the grand ensemble", "Relating variance to heat capacity or compressibility"],
    keyFormulas: ["\\langle (\\Delta E)^2\\rangle=k_BT^2 C_V"],
    commonMisunderstandings: ["Assuming fluctuations vanish in every system", "Confusing ensemble variance with measurement noise", "Ignoring critical enhancement of fluctuations"],
    studyOrder: 12,
    difficulty: "advanced",
    tags: ["variance", "response", "stability"],
  },
];

const supplementalKnowledgeItems: KnowledgeItem[] = [
  {
    id: "units-vectors-dimensional-analysis",
    course: "general-physics",
    title: "Units, Vectors, and Dimensional Analysis",
    alias: ["units", "vectors", "dimensional analysis", "scaling estimates"],
    description:
      "Physical quantities must be expressed with dimensions, units, and vector or scalar character before equations can be interpreted.",
    textbookStyleSummary:
      "Dimensional analysis checks consistency and guides scaling estimates, but it does not replace a dynamical equation or boundary condition. Vector problems require a specified coordinate system, sign convention, and component decomposition.",
    prerequisites: [],
    related: ["Particle Motion and Newton's Laws", "Experimental Measurement and Uncertainty"],
    typicalProblems: [
      "Checking the dimensions of a proposed formula",
      "Resolving vectors into components",
      "Estimating scaling laws from physical variables",
    ],
    keyFormulas: [
      "[F]=MLT^{-2}",
      "\\mathbf{A}=A_x\\hat{\\mathbf{x}}+A_y\\hat{\\mathbf{y}}+A_z\\hat{\\mathbf{z}}",
    ],
    commonMisunderstandings: [
      "Treating dimensional correctness as proof of a formula",
      "Adding quantities with different dimensions",
      "Ignoring vector direction when using scalar magnitudes",
    ],
    studyOrder: 0,
    difficulty: "basic",
    tags: ["units", "vectors", "scaling"],
  },
  {
    id: "circular-motion-and-noninertial-basics",
    course: "general-physics",
    title: "Circular Motion and Elementary Non-Inertial Effects",
    alias: ["circular motion", "centripetal acceleration", "rotating frame basics"],
    description:
      "Circular motion introduces acceleration from changing direction and provides the first contact with frame-dependent inertial forces.",
    textbookStyleSummary:
      "A circular-motion problem should distinguish angular speed, tangential acceleration, centripetal acceleration, and the frame in which forces are written. In a non-inertial frame, fictitious forces are bookkeeping terms required by Newton's form of the equation.",
    prerequisites: ["Particle Motion and Newton's Laws"],
    related: ["Non-Inertial Frames", "Rigid-Body Kinematics"],
    typicalProblems: [
      "Uniform circular motion with tension or normal force",
      "Banked-curve and conical-pendulum problems",
      "Qualitative analysis in a rotating frame",
    ],
    keyFormulas: [
      "a_r=\\frac{v^2}{r}=\\omega^2 r",
      "\\mathbf{F}_{\\mathrm{inertial}}=-m\\mathbf{a}_{\\mathrm{frame}}",
    ],
    commonMisunderstandings: [
      "Calling centripetal force a new interaction",
      "Confusing radial acceleration with tangential acceleration",
      "Mixing inertial and rotating-frame force diagrams",
    ],
    studyOrder: 5,
    difficulty: "basic",
    tags: ["circular motion", "frames", "force analysis"],
  },
  {
    id: "gravitation-and-orbits",
    course: "general-physics",
    title: "Gravitation and Orbital Motion",
    alias: ["Newtonian gravitation", "Kepler motion", "orbital energy"],
    description:
      "Newtonian gravitation connects inverse-square forces, potential energy, central-force motion, and orbital parameters.",
    textbookStyleSummary:
      "Orbital problems should specify whether the body is treated as a test mass, whether the central body is fixed, and which conserved quantities are being used. Energy and angular momentum determine orbit type in the two-body approximation.",
    prerequisites: ["Momentum, Angular Momentum, and Mechanical Energy"],
    related: ["Central-Force Motion", "Central Potentials"],
    typicalProblems: [
      "Circular-orbit speed and period",
      "Escape speed calculations",
      "Energy classification of bound and unbound orbits",
    ],
    keyFormulas: [
      "F=G\\frac{m_1m_2}{r^2}",
      "U(r)=-G\\frac{Mm}{r}",
      "v_{\\mathrm{esc}}=\\sqrt{\\frac{2GM}{r}}",
    ],
    commonMisunderstandings: [
      "Assuming gravitational acceleration is constant over large distances",
      "Confusing orbital speed with escape speed",
      "Forgetting the choice of zero potential energy",
    ],
    studyOrder: 6,
    difficulty: "intermediate",
    tags: ["gravitation", "orbits", "energy"],
  },
  {
    id: "fluid-mechanics-basics",
    course: "general-physics",
    title: "Fluid Statics and Ideal Fluid Flow",
    alias: ["fluid mechanics", "buoyancy", "Bernoulli equation"],
    description:
      "Elementary fluid mechanics studies pressure, buoyancy, continuity, and ideal-flow energy balance.",
    textbookStyleSummary:
      "Fluid statics follows from pressure balance in a gravitational field, while Bernoulli's equation requires steady, incompressible, nonviscous flow along a streamline unless additional assumptions are stated.",
    prerequisites: ["Units, Vectors, and Dimensional Analysis", "Particle Motion and Newton's Laws"],
    related: ["Thermal Processes and Ideal Gases", "Continuum Mechanics"],
    typicalProblems: [
      "Hydrostatic pressure in layered fluids",
      "Buoyancy and apparent weight",
      "Continuity and Bernoulli applications",
    ],
    keyFormulas: [
      "p=p_0+\\rho gh",
      "\\rho A v=\\mathrm{constant}",
      "p+\\frac12\\rho v^2+\\rho gh=\\mathrm{constant}",
    ],
    commonMisunderstandings: [
      "Using Bernoulli's equation across dissipative devices without corrections",
      "Confusing pressure with force",
      "Forgetting that buoyancy depends on displaced fluid",
    ],
    studyOrder: 8,
    difficulty: "intermediate",
    tags: ["pressure", "buoyancy", "Bernoulli"],
  },
  {
    id: "dc-circuits-and-transients",
    course: "general-physics",
    title: "DC Circuits and Transients",
    alias: ["resistor circuits", "RC circuit", "Kirchhoff laws"],
    description:
      "Circuit analysis models lumped elements through current, voltage, energy storage, and network constraints.",
    textbookStyleSummary:
      "Kirchhoff's laws apply to lumped circuits when propagation effects can be neglected. Transient problems require initial capacitor voltage or inductor current and a clear switching condition.",
    prerequisites: ["Electromagnetism Basics"],
    related: ["Electrostatics", "Electromagnetic Waves"],
    typicalProblems: [
      "Equivalent resistance and voltage division",
      "Kirchhoff-loop and node equations",
      "RC charging and discharging transients",
    ],
    keyFormulas: [
      "V=IR",
      "\\sum I=0",
      "q(t)=CV\\left(1-e^{-t/RC}\\right)",
    ],
    commonMisunderstandings: [
      "Treating current as consumed by circuit elements",
      "Ignoring capacitor initial conditions",
      "Applying Kirchhoff laws outside the lumped-circuit approximation",
    ],
    studyOrder: 11,
    difficulty: "basic",
    tags: ["circuits", "Kirchhoff laws", "transients"],
  },
  {
    id: "geometrical-optics",
    course: "general-physics",
    title: "Geometrical Optics",
    alias: ["ray optics", "lenses", "mirrors"],
    description:
      "Geometrical optics approximates light propagation by rays when wavelengths are small compared with optical elements.",
    textbookStyleSummary:
      "Ray diagrams and imaging formulas require a sign convention and the paraxial approximation. Wave effects such as diffraction set the limit of geometrical optics.",
    prerequisites: ["Oscillations, Waves, and Optics"],
    related: ["Electromagnetic Waves", "Fourier Series and Fourier Transform"],
    typicalProblems: [
      "Thin-lens image construction",
      "Spherical mirror imaging",
      "Optical instrument magnification",
    ],
    keyFormulas: [
      "\\frac1f=\\frac1s+\\frac1{s'}",
      "m=-\\frac{s'}{s}",
    ],
    commonMisunderstandings: [
      "Changing sign conventions mid-problem",
      "Applying thin-lens formulas outside the paraxial regime",
      "Ignoring diffraction limits",
    ],
    studyOrder: 12,
    difficulty: "basic",
    tags: ["ray optics", "lenses", "imaging"],
  },
  {
    id: "modern-physics-foundations",
    course: "general-physics",
    title: "Modern Physics Foundations",
    alias: ["special relativity basics", "photoelectric effect", "de Broglie waves"],
    description:
      "Modern physics introduces relativity and quantum ideas that motivate later quantum mechanics and electrodynamics.",
    textbookStyleSummary:
      "Introductory modern-physics problems should state the approximation level clearly: relativistic kinematics, photon energy, matter-wave relations, and simple atomic spectra are not interchangeable models.",
    prerequisites: ["Oscillations, Waves, and Optics", "Electromagnetism Basics"],
    related: ["Wave Function and State Vector", "Relativistic Electrodynamics"],
    typicalProblems: [
      "Photoelectric-effect threshold calculations",
      "de Broglie wavelength estimates",
      "Time dilation and relativistic energy problems",
    ],
    keyFormulas: [
      "E=h\\nu",
      "\\lambda=\\frac{h}{p}",
      "E^2=p^2c^2+m^2c^4",
    ],
    commonMisunderstandings: [
      "Using nonrelativistic kinetic energy at relativistic speeds",
      "Confusing photon frequency with electron orbital frequency",
      "Treating matter waves as classical mechanical waves",
    ],
    studyOrder: 13,
    difficulty: "intermediate",
    tags: ["modern physics", "relativity", "quantization"],
  },
  {
    id: "vector-analysis-curvilinear-coordinates",
    course: "math-physics",
    title: "Vector Analysis and Curvilinear Coordinates",
    alias: ["gradient", "divergence", "curl", "orthogonal coordinates"],
    description:
      "Vector analysis supplies the differential and integral operations used to express field equations in different coordinate systems.",
    textbookStyleSummary:
      "Before applying a vector operator, specify the coordinate system, scale factors, orientation, and domain. Curvilinear formulas are coordinate representations of geometric operations, not new physical laws.",
    prerequisites: ["Units, Vectors, and Dimensional Analysis"],
    related: ["Equations of Mathematical Physics", "Electrostatics", "Electromagnetic Boundary Conditions"],
    typicalProblems: [
      "Computing gradient, divergence, and curl in cylindrical coordinates",
      "Using Gauss and Stokes theorems",
      "Writing Laplacians in spherical coordinates",
    ],
    keyFormulas: [
      "\\nabla\\cdot\\mathbf{A}=\\frac{1}{h_1h_2h_3}\\sum_i\\frac{\\partial}{\\partial q_i}\\left(\\frac{h_1h_2h_3}{h_i}A_i\\right)",
      "\\nabla^2 f=\\nabla\\cdot\\nabla f",
    ],
    commonMisunderstandings: [
      "Using Cartesian operator formulas in curvilinear coordinates",
      "Forgetting scale factors",
      "Confusing vector components with basis vectors",
    ],
    studyOrder: 0,
    difficulty: "basic",
    tags: ["vector analysis", "coordinates", "field operators"],
  },
  {
    id: "ordinary-differential-equations",
    course: "math-physics",
    title: "Ordinary Differential Equations",
    alias: ["ODE", "linear differential equations", "series solution"],
    description:
      "Ordinary differential equations describe single-variable dynamics and appear as separated equations in many physics problems.",
    textbookStyleSummary:
      "A linear ODE problem requires the equation, domain, initial or boundary data, and any regularity conditions. Series solutions require identifying ordinary points, regular singular points, and recurrence relations.",
    prerequisites: ["Calculus", "Linear Algebra"],
    related: ["Separation of Variables", "Special Functions", "Sturm-Liouville Eigenvalue Problems"],
    typicalProblems: [
      "Solving second-order linear equations with constant coefficients",
      "Power-series solutions near ordinary points",
      "Frobenius solutions near regular singular points",
    ],
    keyFormulas: [
      "a_2(x)y''+a_1(x)y'+a_0(x)y=f(x)",
      "y(x)=\\sum_{n=0}^{\\infty}a_n(x-x_0)^n",
    ],
    commonMisunderstandings: [
      "Giving a general solution without applying conditions",
      "Using a power series outside its convergence range",
      "Confusing homogeneous and particular solutions",
    ],
    studyOrder: 0.5,
    difficulty: "basic",
    tags: ["ODE", "series solution", "conditions"],
  },
  {
    id: "distributions-and-delta-function",
    course: "math-physics",
    title: "Distributions and Delta Functions",
    alias: ["Dirac delta", "generalized functions", "step function"],
    description:
      "Distributions extend functions so that point sources, jumps, impulses, and weak derivatives can be treated systematically.",
    textbookStyleSummary:
      "The delta function is defined by its action under integration, not by an ordinary pointwise value. Jump conditions often follow by integrating a differential equation across a singular point.",
    prerequisites: ["Integral Transforms", "Vector Analysis and Curvilinear Coordinates"],
    related: ["Green's Functions", "Electrostatics", "Scattering Theory"],
    typicalProblems: [
      "Using delta functions to represent point sources",
      "Deriving jump conditions for one-dimensional Green functions",
      "Computing Fourier transforms of distributions",
    ],
    keyFormulas: [
      "\\int_{-\\infty}^{\\infty}\\delta(x-a)f(x)\\,dx=f(a)",
      "\\frac{d}{dx}H(x-a)=\\delta(x-a)",
    ],
    commonMisunderstandings: [
      "Treating \\delta(0) as an ordinary number",
      "Ignoring test functions and integration domains",
      "Forgetting discontinuity conditions at sources",
    ],
    studyOrder: 4.5,
    difficulty: "intermediate",
    tags: ["delta function", "weak derivative", "point source"],
  },
  {
    id: "spherical-and-cylindrical-harmonics",
    course: "math-physics",
    title: "Cylindrical and Spherical Harmonics",
    alias: ["spherical harmonics", "Bessel modes", "Legendre polynomials"],
    description:
      "Cylindrical and spherical harmonics arise from angular and radial separated equations in symmetric geometries.",
    textbookStyleSummary:
      "The coordinate symmetry determines the angular functions and radial equations. Boundary regularity and orthogonality fix allowed modes and expansion coefficients.",
    prerequisites: ["Separation of Variables", "Special Functions"],
    related: ["Central Potentials", "Multipole Expansion", "Electrostatic Boundary-Value Problems"],
    typicalProblems: [
      "Solving Laplace equations in spherical coordinates",
      "Expanding boundary data in Legendre polynomials",
      "Using Bessel zeros in cylindrical boundary-value problems",
    ],
    keyFormulas: [
      "Y_{\\ell m}(\\theta,\\phi)=N_{\\ell m}P_{\\ell}^{m}(\\cos\\theta)e^{im\\phi}",
      "x^2R''+xR'+(x^2-m^2)R=0",
    ],
    commonMisunderstandings: [
      "Using Cartesian Fourier modes in spherical geometry",
      "Ignoring regularity at the origin or axis",
      "Mixing normalization conventions for harmonics",
    ],
    studyOrder: 10.5,
    difficulty: "advanced",
    tags: ["spherical harmonics", "Bessel functions", "symmetry"],
  },
  {
    id: "asymptotic-and-approximation-methods",
    course: "math-physics",
    title: "Asymptotic and Approximation Methods",
    alias: ["asymptotic expansion", "stationary phase", "saddle point"],
    description:
      "Asymptotic methods extract approximate behavior when a parameter is large, small, or singular.",
    textbookStyleSummary:
      "An asymptotic expansion is ordered by a limiting parameter and has a stated range of validity. The leading term may capture the dominant behavior even when the series is not convergent.",
    prerequisites: ["Complex Functions", "Integral Transforms"],
    related: ["WKB Approximation", "Perturbation Theory", "Fluctuations"],
    typicalProblems: [
      "Estimating integrals by Laplace's method",
      "Using stationary phase for oscillatory integrals",
      "Finding leading behavior of special functions",
    ],
    keyFormulas: [
      "\\int e^{\\lambda f(x)}g(x)\\,dx\\sim e^{\\lambda f(x_0)}g(x_0)\\sqrt{\\frac{2\\pi}{-\\lambda f''(x_0)}}",
    ],
    commonMisunderstandings: [
      "Confusing asymptotic accuracy with convergence",
      "Not stating the limiting parameter",
      "Using an approximation outside its scale range",
    ],
    studyOrder: 11.5,
    difficulty: "advanced",
    tags: ["asymptotics", "stationary phase", "approximation"],
  },
  {
    id: "calculus-of-variations-mechanics",
    course: "theoretical-mechanics",
    title: "Calculus of Variations in Mechanics",
    alias: ["Euler-Lagrange equation", "functional variation", "fixed endpoints"],
    description:
      "Variational calculus provides the mathematical basis for action principles and Euler-Lagrange equations.",
    textbookStyleSummary:
      "A variational problem must state the functional, admissible paths, endpoint conditions, and independent variables. Fixed endpoints imply vanishing endpoint variations, which remove boundary terms after integration by parts.",
    prerequisites: ["Basics of Variational Methods"],
    related: ["Hamilton's Principle", "Lagrange Equations"],
    typicalProblems: [
      "Deriving Euler-Lagrange equations from a functional",
      "Handling fixed and free endpoint conditions",
      "Finding extremal curves for simple functionals",
    ],
    keyFormulas: [
      "\\delta J=0,\\quad J[y]=\\int_{x_1}^{x_2}F(y,y',x)\\,dx",
      "\\frac{\\partial F}{\\partial y}-\\frac{d}{dx}\\frac{\\partial F}{\\partial y'}=0",
    ],
    commonMisunderstandings: [
      "Varying endpoints that are fixed by the problem",
      "Dropping boundary terms without checking conditions",
      "Treating extremum as always a minimum",
    ],
    studyOrder: 5.5,
    difficulty: "intermediate",
    tags: ["variation", "action", "Euler-Lagrange"],
  },
  {
    id: "lagrange-multipliers-and-nonholonomic-constraints",
    course: "theoretical-mechanics",
    title: "Lagrange Multipliers and Nonholonomic Constraints",
    alias: ["constraint multipliers", "nonholonomic constraints", "undetermined multipliers"],
    description:
      "Multiplier methods handle constraint forces explicitly when constraints cannot be eliminated by choosing independent coordinates.",
    textbookStyleSummary:
      "Holonomic constraints can often be built into generalized coordinates, while nonholonomic constraints require careful velocity-level treatment. Multipliers represent constraint-force components only under the stated virtual-work assumptions.",
    prerequisites: ["Virtual Work and Constraints", "Lagrange Equations"],
    related: ["Non-Inertial Frames", "Hamiltonian Equations"],
    typicalProblems: [
      "Finding constraint forces with multipliers",
      "Rolling constraints without slipping",
      "Comparing eliminable and nonholonomic constraints",
    ],
    keyFormulas: [
      "\\frac{d}{dt}\\frac{\\partial L}{\\partial \\dot q_i}-\\frac{\\partial L}{\\partial q_i}=Q_i+\\sum_\\alpha \\lambda_\\alpha a_{\\alpha i}",
    ],
    commonMisunderstandings: [
      "Treating all velocity constraints as integrated coordinate constraints",
      "Ignoring whether virtual displacements satisfy the constraint",
      "Assigning physical meaning to multipliers without checking units and directions",
    ],
    studyOrder: 7.5,
    difficulty: "advanced",
    tags: ["constraints", "multipliers", "nonholonomic"],
  },
  {
    id: "noether-theorem-and-conservation-laws",
    course: "theoretical-mechanics",
    title: "Noether Theorem and Conservation Laws",
    alias: ["symmetry", "cyclic coordinate", "conserved quantity"],
    description:
      "Noether's theorem links continuous symmetries of the action to conserved quantities.",
    textbookStyleSummary:
      "A cyclic coordinate gives a conserved canonical momentum, but the deeper statement is invariance of the action under a continuous transformation. The conserved quantity depends on the transformation, not only on the coordinate name.",
    prerequisites: ["Hamilton's Principle", "Lagrange Equations"],
    related: ["Canonical Transformations and Poisson Brackets", "Hamiltonian Equations"],
    typicalProblems: [
      "Identifying cyclic coordinates",
      "Deriving energy and momentum conservation from symmetry",
      "Using conserved quantities to reduce motion",
    ],
    keyFormulas: [
      "\\frac{\\partial L}{\\partial q_i}=0\\Rightarrow p_i=\\frac{\\partial L}{\\partial \\dot q_i}=\\mathrm{constant}",
    ],
    commonMisunderstandings: [
      "Equating every conserved quantity with energy",
      "Confusing coordinate independence with physical symmetry",
      "Ignoring explicit time dependence of the Lagrangian",
    ],
    studyOrder: 8.5,
    difficulty: "advanced",
    tags: ["symmetry", "Noether theorem", "conservation"],
  },
  {
    id: "hamilton-jacobi-theory",
    course: "theoretical-mechanics",
    title: "Hamilton-Jacobi Theory",
    alias: ["Hamilton-Jacobi equation", "principal function", "complete integral"],
    description:
      "Hamilton-Jacobi theory reformulates mechanics as a first-order partial differential equation for the action.",
    textbookStyleSummary:
      "The Hamilton-Jacobi equation is useful when a complete integral can generate canonical transformations to constants of motion. Separation depends on coordinates and conserved quantities.",
    prerequisites: ["Hamiltonian Equations", "Canonical Transformations and Poisson Brackets"],
    related: ["Action-Angle Variables", "WKB Approximation"],
    typicalProblems: [
      "Solving separable Hamilton-Jacobi equations",
      "Deriving trajectories from the principal function",
      "Connecting classical action with semiclassical phase",
    ],
    keyFormulas: [
      "H\\left(q_i,\\frac{\\partial S}{\\partial q_i},t\\right)+\\frac{\\partial S}{\\partial t}=0",
    ],
    commonMisunderstandings: [
      "Treating the action function as ordinary energy",
      "Forgetting the role of integration constants",
      "Assuming every Hamilton-Jacobi equation separates",
    ],
    studyOrder: 10.5,
    difficulty: "advanced",
    tags: ["Hamilton-Jacobi", "action", "separation"],
  },
  {
    id: "action-angle-variables",
    course: "theoretical-mechanics",
    title: "Action-Angle Variables",
    alias: ["integrable systems", "adiabatic invariant", "angle variables"],
    description:
      "Action-angle variables describe periodic integrable motion through conserved actions and uniformly advancing angles.",
    textbookStyleSummary:
      "Action variables are phase-space integrals over closed orbits. The construction assumes integrability and is especially useful for oscillatory motion and perturbative treatments.",
    prerequisites: ["Hamilton-Jacobi Theory", "Canonical Transformations and Poisson Brackets"],
    related: ["Small Oscillations", "Quantum Harmonic Oscillator"],
    typicalProblems: [
      "Computing the action for a one-dimensional oscillator",
      "Finding frequencies from the Hamiltonian in action variables",
      "Using adiabatic invariance qualitatively",
    ],
    keyFormulas: [
      "J_i=\\frac{1}{2\\pi}\\oint p_i\\,dq_i",
      "\\dot\\theta_i=\\frac{\\partial H}{\\partial J_i}",
    ],
    commonMisunderstandings: [
      "Applying action-angle variables to nonintegrable systems without justification",
      "Dropping the closed-orbit condition",
      "Confusing angle variables with ordinary polar angles",
    ],
    studyOrder: 11.5,
    difficulty: "advanced",
    tags: ["action-angle", "integrability", "periodic motion"],
  },
  {
    id: "fields-in-matter",
    course: "electrodynamics",
    title: "Fields in Matter",
    alias: ["polarization", "magnetization", "bound charge", "macroscopic fields"],
    description:
      "Fields in matter separate free and bound sources through polarization, magnetization, and macroscopic field variables.",
    textbookStyleSummary:
      "The distinction between $\\mathbf{E}$, $\\mathbf{D}$, $\\mathbf{B}$, and $\\mathbf{H}$ depends on how material response is modeled. Constitutive relations are additional assumptions, not Maxwell equations themselves.",
    prerequisites: ["Electrostatics", "Magnetostatics"],
    related: ["Electromagnetic Boundary Conditions", "Maxwell Equations"],
    typicalProblems: [
      "Finding bound charge from polarization",
      "Using linear dielectric boundary conditions",
      "Computing magnetization current",
    ],
    keyFormulas: [
      "\\rho_b=-\\nabla\\cdot\\mathbf{P}",
      "\\mathbf{D}=\\varepsilon_0\\mathbf{E}+\\mathbf{P}",
      "\\mathbf{H}=\\frac{1}{\\mu_0}\\mathbf{B}-\\mathbf{M}",
    ],
    commonMisunderstandings: [
      "Treating constitutive relations as universal laws",
      "Confusing free and bound charge",
      "Using vacuum boundary conditions inside matter",
    ],
    studyOrder: 5.5,
    difficulty: "intermediate",
    tags: ["matter", "polarization", "magnetization"],
  },
  {
    id: "electromagnetic-boundary-conditions",
    course: "electrodynamics",
    title: "Electromagnetic Boundary Conditions",
    alias: ["interface conditions", "surface charge", "surface current"],
    description:
      "Boundary conditions connect field components across material interfaces and conducting surfaces.",
    textbookStyleSummary:
      "Boundary conditions follow from integral Maxwell equations applied to small pillboxes and loops. The discontinuities depend on free surface charge and free surface current, while constitutive laws determine material response.",
    prerequisites: ["Maxwell Equations", "Fields in Matter"],
    related: ["Electrostatic Boundary-Value Problems", "Electromagnetic Waves"],
    typicalProblems: [
      "Field discontinuities across dielectric interfaces",
      "Conducting-surface electrostatic conditions",
      "Plane-wave reflection and transmission at normal incidence",
    ],
    keyFormulas: [
      "\\hat{\\mathbf{n}}\\cdot(\\mathbf{D}_2-\\mathbf{D}_1)=\\sigma_f",
      "\\hat{\\mathbf{n}}\\times(\\mathbf{H}_2-\\mathbf{H}_1)=\\mathbf{K}_f",
    ],
    commonMisunderstandings: [
      "Applying normal-component rules to tangential components",
      "Forgetting surface sources",
      "Using boundary conditions without specifying the normal direction",
    ],
    studyOrder: 6.5,
    difficulty: "intermediate",
    tags: ["boundary conditions", "interfaces", "surface sources"],
  },
  {
    id: "poynting-theorem-and-field-momentum",
    course: "electrodynamics",
    title: "Poynting Theorem and Field Momentum",
    alias: ["energy conservation", "Poynting vector", "electromagnetic momentum"],
    description:
      "Poynting's theorem expresses energy transfer between fields, charges, and electromagnetic energy flux.",
    textbookStyleSummary:
      "Energy-density and flux expressions depend on the field model and medium assumptions. A complete problem should specify the volume, surface, and work done on charges.",
    prerequisites: ["Maxwell Equations"],
    related: ["Electromagnetic Waves", "Electromagnetic Radiation"],
    typicalProblems: [
      "Computing energy flux in a plane wave",
      "Using Poynting's theorem for charging systems",
      "Estimating radiation pressure",
    ],
    keyFormulas: [
      "\\mathbf{S}=\\mathbf{E}\\times\\mathbf{H}",
      "\\frac{\\partial u}{\\partial t}+\\nabla\\cdot\\mathbf{S}=-\\mathbf{J}\\cdot\\mathbf{E}",
    ],
    commonMisunderstandings: [
      "Confusing field energy flow with charge motion",
      "Ignoring surface terms in conservation laws",
      "Using vacuum energy density in arbitrary media without assumptions",
    ],
    studyOrder: 7.5,
    difficulty: "intermediate",
    tags: ["Poynting theorem", "energy flux", "field momentum"],
  },
  {
    id: "waveguides-and-resonant-cavities",
    course: "electrodynamics",
    title: "Waveguides and Resonant Cavities",
    alias: ["waveguides", "TE modes", "TM modes", "cavity modes"],
    description:
      "Waveguides and cavities confine electromagnetic waves, producing modal propagation and discrete resonance frequencies.",
    textbookStyleSummary:
      "Mode classification depends on boundary conditions on conducting surfaces and the propagation direction. Cutoff frequencies determine whether a mode propagates or decays.",
    prerequisites: ["Electromagnetic Waves", "Electromagnetic Boundary Conditions"],
    related: ["Separation of Variables", "Poynting Theorem and Field Momentum"],
    typicalProblems: [
      "Finding cutoff frequencies in rectangular waveguides",
      "Classifying TE and TM modes",
      "Determining cavity resonance frequencies",
    ],
    keyFormulas: [
      "k^2=k_c^2+\\beta^2",
      "\\omega_c=ck_c",
    ],
    commonMisunderstandings: [
      "Assuming every frequency propagates in a guide",
      "Mixing TE and TM boundary conditions",
      "Ignoring conductor boundary constraints",
    ],
    studyOrder: 8.5,
    difficulty: "advanced",
    tags: ["waveguide", "modes", "cutoff"],
  },
  {
    id: "hilbert-space-and-dirac-notation",
    course: "quantum-mechanics",
    title: "Hilbert Space and Dirac Notation",
    alias: ["bra-ket notation", "Hilbert space", "inner product"],
    description:
      "Quantum states are vectors in a Hilbert space, and Dirac notation expresses states, dual vectors, inner products, and operators compactly.",
    textbookStyleSummary:
      "The notation $|\\psi\\rangle$ represents an abstract state, while wave functions are its components in a chosen basis. Inner products, normalization, and completeness depend on the Hilbert-space structure.",
    prerequisites: ["Linear Algebra"],
    related: ["Wave Function and State Vector", "Representations", "Operators and Observables"],
    typicalProblems: [
      "Expanding a state in an orthonormal basis",
      "Using completeness relations",
      "Computing probabilities from inner products",
    ],
    keyFormulas: [
      "\\langle \\phi|\\psi\\rangle",
      "\\sum_n |n\\rangle\\langle n|=I",
    ],
    commonMisunderstandings: [
      "Equating a ket with a particular wave function",
      "Forgetting complex conjugation in inner products",
      "Using non-normalized states for probabilities",
    ],
    studyOrder: 0,
    difficulty: "basic",
    tags: ["Hilbert space", "Dirac notation", "basis"],
  },
  {
    id: "measurement-postulates",
    course: "quantum-mechanics",
    title: "Measurement Postulates",
    alias: ["Born rule", "projection postulate", "measurement probability"],
    description:
      "Measurement connects the state vector with observable eigenvalues, probabilities, and post-measurement states.",
    textbookStyleSummary:
      "An ideal measurement of an observable yields an eigenvalue with probability determined by projection onto the corresponding eigenspace. Degeneracy requires projecting onto the full degenerate subspace.",
    prerequisites: ["Operators and Observables", "Hilbert Space and Dirac Notation"],
    related: ["Representations", "Spin", "Angular Momentum"],
    typicalProblems: [
      "Computing measurement probabilities in a finite basis",
      "Post-measurement state normalization",
      "Handling degenerate measurement outcomes",
    ],
    keyFormulas: [
      "P(a_n)=|\\langle a_n|\\psi\\rangle|^2",
      "|\\psi'\\rangle=\\frac{P_n|\\psi\\rangle}{\\sqrt{\\langle\\psi|P_n|\\psi\\rangle}}",
    ],
    commonMisunderstandings: [
      "Confusing expectation value with a possible measurement result",
      "Ignoring degeneracy",
      "Forgetting to renormalize after projection",
    ],
    studyOrder: 4.5,
    difficulty: "intermediate",
    tags: ["measurement", "Born rule", "projection"],
  },
  {
    id: "addition-of-angular-momenta",
    course: "quantum-mechanics",
    title: "Addition of Angular Momenta",
    alias: ["Clebsch-Gordan coefficients", "coupled basis", "uncoupled basis"],
    description:
      "Adding angular momenta relates product bases to coupled total-angular-momentum bases.",
    textbookStyleSummary:
      "The allowed total quantum numbers follow from triangle rules, while Clebsch-Gordan coefficients define the basis transformation. Physical interpretation depends on which commuting observables are diagonal.",
    prerequisites: ["Angular Momentum", "Spin"],
    related: ["Identical Particles", "Measurement Postulates"],
    typicalProblems: [
      "Finding allowed total angular momenta",
      "Transforming between coupled and uncoupled bases",
      "Constructing singlet and triplet spin states",
    ],
    keyFormulas: [
      "|jm\\rangle=\\sum_{m_1,m_2}C^{jm}_{j_1m_1j_2m_2}|j_1m_1\\rangle|j_2m_2\\rangle",
    ],
    commonMisunderstandings: [
      "Adding quantum numbers as ordinary scalars without selection rules",
      "Confusing $m$ with $j$",
      "Ignoring basis labels in coupled states",
    ],
    studyOrder: 8.5,
    difficulty: "advanced",
    tags: ["angular momentum", "Clebsch-Gordan", "coupled basis"],
  },
  {
    id: "wkb-approximation",
    course: "quantum-mechanics",
    title: "WKB Approximation",
    alias: ["semiclassical approximation", "turning point", "connection formula"],
    description:
      "The WKB approximation estimates wave functions and spectra when the potential varies slowly on the de Broglie wavelength scale.",
    textbookStyleSummary:
      "WKB solutions have different forms in classically allowed and forbidden regions and require connection formulas near turning points. Quantization conditions follow from phase accumulation and boundary behavior.",
    prerequisites: ["One-Dimensional Stationary States", "Asymptotic and Approximation Methods"],
    related: ["Hamilton-Jacobi Theory", "Scattering Theory"],
    typicalProblems: [
      "Applying WKB quantization to bound states",
      "Estimating tunneling probabilities",
      "Identifying turning points and validity conditions",
    ],
    keyFormulas: [
      "\\psi(x)\\approx \\frac{C}{\\sqrt{p(x)}}\\exp\\left(\\pm\\frac{i}{\\hbar}\\int^x p(x')\\,dx'\\right)",
      "\\int_{x_1}^{x_2}p(x)\\,dx=\\left(n+\\frac12\\right)\\pi\\hbar",
    ],
    commonMisunderstandings: [
      "Using WKB at turning points without connection formulas",
      "Ignoring the slow-variation condition",
      "Applying bound-state quantization to scattering states",
    ],
    studyOrder: 11.5,
    difficulty: "advanced",
    tags: ["WKB", "semiclassical", "tunneling"],
  },
  {
    id: "time-dependent-perturbation",
    course: "quantum-mechanics",
    title: "Time-Dependent Perturbation Theory",
    alias: ["transition probability", "Fermi golden rule", "driven quantum system"],
    description:
      "Time-dependent perturbation theory describes transitions induced by weak time-varying interactions.",
    textbookStyleSummary:
      "A transition calculation must specify the unperturbed states, perturbation, time dependence, initial state, and approximation order. Resonance and density of final states enter long-time transition rates.",
    prerequisites: ["Perturbation Theory", "Schrodinger Equation"],
    related: ["Electromagnetic Radiation", "Scattering Theory"],
    typicalProblems: [
      "First-order transition amplitudes",
      "Sinusoidal perturbation and resonance",
      "Using Fermi's golden rule",
    ],
    keyFormulas: [
      "c_f^{(1)}(t)=-\\frac{i}{\\hbar}\\int_0^t \\langle f|V(t')|i\\rangle e^{i\\omega_{fi}t'}\\,dt'",
      "W_{i\\to f}=\\frac{2\\pi}{\\hbar}|V_{fi}|^2\\rho(E_f)",
    ],
    commonMisunderstandings: [
      "Using time-independent formulas for driven transitions",
      "Forgetting phase factors from unperturbed evolution",
      "Applying Fermi's golden rule without a continuum or long-time limit",
    ],
    studyOrder: 11.7,
    difficulty: "advanced",
    tags: ["transition", "perturbation", "resonance"],
  },
  {
    id: "density-matrix-and-mixed-states",
    course: "quantum-mechanics",
    title: "Density Matrix and Mixed States",
    alias: ["density operator", "mixed state", "pure state"],
    description:
      "The density matrix describes statistical mixtures and subsystems when a single state vector is insufficient.",
    textbookStyleSummary:
      "A pure state satisfies $\\rho^2=\\rho$, while a mixed state encodes classical uncertainty or reduced subsystem information. Expectation values are computed by traces over the relevant Hilbert space.",
    prerequisites: ["Hilbert Space and Dirac Notation", "Measurement Postulates"],
    related: ["Identical Particles", "Quantum Statistics"],
    typicalProblems: [
      "Distinguishing pure and mixed spin states",
      "Computing expectation values with traces",
      "Finding reduced density matrices",
    ],
    keyFormulas: [
      "\\rho=\\sum_i p_i|\\psi_i\\rangle\\langle\\psi_i|",
      "\\langle A\\rangle=\\operatorname{Tr}(\\rho A)",
    ],
    commonMisunderstandings: [
      "Confusing superposition with statistical mixture",
      "Forgetting trace normalization",
      "Treating subsystem states as pure after tracing out correlations",
    ],
    studyOrder: 12.5,
    difficulty: "advanced",
    tags: ["density matrix", "mixed state", "trace"],
  },
  {
    id: "thermodynamic-equilibrium-and-state-functions",
    course: "thermo-stat",
    title: "Equilibrium and State Functions",
    alias: ["equilibrium state", "state variable", "equation of state"],
    description:
      "Thermodynamics begins by distinguishing equilibrium states, state functions, and process-dependent transfers.",
    textbookStyleSummary:
      "A thermodynamic state is specified by a sufficient set of independent variables and an equation of state. Heat and work describe processes, while internal energy, entropy, and thermodynamic potentials describe states.",
    prerequisites: ["Thermal Processes and Ideal Gases"],
    related: ["Thermodynamic Laws", "Thermodynamic Properties of Uniform Matter"],
    typicalProblems: [
      "Identifying independent variables",
      "Distinguishing state functions from path functions",
      "Using equations of state to compute derivatives",
    ],
    keyFormulas: [
      "f(p,V,T,N)=0",
      "dU=\\delta Q-\\delta W",
    ],
    commonMisunderstandings: [
      "Treating heat as stored in a system",
      "Using path-dependent quantities as coordinates of state",
      "Ignoring equilibrium assumptions",
    ],
    studyOrder: 0,
    difficulty: "basic",
    tags: ["equilibrium", "state function", "process"],
  },
  {
    id: "chemical-potential-and-open-systems",
    course: "thermo-stat",
    title: "Chemical Potential and Open Systems",
    alias: ["chemical potential", "open system", "particle exchange"],
    description:
      "Chemical potential measures the change in thermodynamic potential when particle number changes under specified constraints.",
    textbookStyleSummary:
      "The meaning of chemical potential depends on the potential and natural variables being used. It is central to phase equilibrium, diffusion, reactions, and particle exchange with reservoirs.",
    prerequisites: ["Thermodynamic Potentials"],
    related: ["Grand Canonical Ensemble", "Phase Equilibrium"],
    typicalProblems: [
      "Deriving chemical-potential terms in thermodynamic differentials",
      "Using equality of chemical potentials for equilibrium",
      "Analyzing particle exchange between subsystems",
    ],
    keyFormulas: [
      "\\mu=\\left(\\frac{\\partial U}{\\partial N}\\right)_{S,V}",
      "dF=-S\\,dT-p\\,dV+\\mu\\,dN",
    ],
    commonMisunderstandings: [
      "Treating chemical potential as ordinary potential energy",
      "Ignoring fixed variables in its definition",
      "Forgetting particle-number constraints",
    ],
    studyOrder: 4.5,
    difficulty: "intermediate",
    tags: ["chemical potential", "open system", "particle number"],
  },
  {
    id: "ideal-quantum-gases",
    course: "thermo-stat",
    title: "Ideal Quantum Gases",
    alias: ["ideal Bose gas", "ideal Fermi gas", "quantum gas"],
    description:
      "Ideal quantum gases apply Bose-Einstein or Fermi-Dirac occupation rules to noninteracting particles.",
    textbookStyleSummary:
      "The thermodynamics of an ideal quantum gas follows from single-particle states, occupation numbers, density of states, and particle-number constraints. The classical limit is recovered when phase-space density is small.",
    prerequisites: ["Quantum Statistics", "Grand Canonical Ensemble"],
    related: ["Bose-Einstein Condensation", "Degenerate Fermi Gas"],
    typicalProblems: [
      "Computing particle number from density of states",
      "Taking the classical limit of quantum distributions",
      "Comparing Bose and Fermi occupation behavior",
    ],
    keyFormulas: [
      "N=\\sum_i \\frac{1}{e^{\\beta(\\epsilon_i-\\mu)}\\mp1}",
      "g(\\epsilon)\\,d\\epsilon\\propto V\\epsilon^{1/2}\\,d\\epsilon",
    ],
    commonMisunderstandings: [
      "Using a fixed chemical potential without enforcing particle number",
      "Mixing Bose and Fermi signs",
      "Applying classical equipartition in the degenerate regime",
    ],
    studyOrder: 11.5,
    difficulty: "advanced",
    tags: ["quantum gas", "density of states", "occupation"],
  },
  {
    id: "bose-einstein-condensation",
    course: "thermo-stat",
    title: "Bose-Einstein Condensation",
    alias: ["Bose condensation", "critical temperature", "ground-state occupation"],
    description:
      "Bose-Einstein condensation occurs when a macroscopic number of bosons occupy the ground state below a critical temperature.",
    textbookStyleSummary:
      "The transition follows from the saturation of excited-state occupation under particle-number conservation. It requires bosons and is usually discussed for ideal or weakly interacting gases.",
    prerequisites: ["Ideal Quantum Gases"],
    related: ["Quantum Statistics", "Phase Equilibrium"],
    typicalProblems: [
      "Deriving critical temperature for an ideal Bose gas",
      "Computing condensate fraction",
      "Separating ground-state and excited-state contributions",
    ],
    keyFormulas: [
      "\\frac{N_0}{N}=1-\\left(\\frac{T}{T_c}\\right)^{3/2}",
    ],
    commonMisunderstandings: [
      "Treating condensation as ordinary gas-liquid condensation",
      "Forgetting the separate ground-state term",
      "Applying the result to fermions",
    ],
    studyOrder: 12.2,
    difficulty: "advanced",
    tags: ["Bose gas", "condensation", "critical temperature"],
  },
  {
    id: "degenerate-fermi-gas",
    course: "thermo-stat",
    title: "Degenerate Fermi Gas",
    alias: ["Fermi energy", "Fermi temperature", "electron gas"],
    description:
      "A degenerate Fermi gas is governed by the Pauli principle and remains quantum even at low temperature.",
    textbookStyleSummary:
      "At zero temperature, fermions fill single-particle states up to the Fermi energy. Low-temperature behavior is controlled by excitations near the Fermi surface rather than all particles equally.",
    prerequisites: ["Ideal Quantum Gases"],
    related: ["Fermi-Dirac Statistics", "Identical Particles"],
    typicalProblems: [
      "Computing Fermi energy and Fermi temperature",
      "Finding pressure of a zero-temperature Fermi gas",
      "Estimating low-temperature heat capacity",
    ],
    keyFormulas: [
      "E_F=\\frac{\\hbar^2}{2m}(3\\pi^2 n)^{2/3}",
      "f(\\epsilon)=\\frac{1}{e^{\\beta(\\epsilon-\\mu)}+1}",
    ],
    commonMisunderstandings: [
      "Assuming all fermions contribute equally to low-temperature heat capacity",
      "Confusing Fermi energy with average thermal energy",
      "Using Maxwell-Boltzmann statistics in the degenerate regime",
    ],
    studyOrder: 12.4,
    difficulty: "advanced",
    tags: ["Fermi gas", "degeneracy", "Fermi energy"],
  },
  {
    id: "critical-phenomena-and-scaling",
    course: "thermo-stat",
    title: "Critical Phenomena and Scaling",
    alias: ["critical point", "critical exponents", "scaling laws"],
    description:
      "Critical phenomena describe universal behavior near continuous phase transitions, where fluctuations become long ranged.",
    textbookStyleSummary:
      "Near a critical point, response functions can diverge and simple mean-field descriptions may fail. Scaling laws characterize how observables depend on reduced temperature, field, and system size.",
    prerequisites: ["Phase Equilibrium", "Fluctuations"],
    related: ["Statistical Postulates", "Asymptotic and Approximation Methods"],
    typicalProblems: [
      "Identifying order parameters",
      "Using critical exponent definitions",
      "Comparing mean-field predictions with scaling behavior",
    ],
    keyFormulas: [
      "C\\sim |T-T_c|^{-\\alpha}",
      "\\xi\\sim |T-T_c|^{-\\nu}",
    ],
    commonMisunderstandings: [
      "Treating all phase transitions as first order",
      "Ignoring finite-size effects near criticality",
      "Assuming mean-field exponents are always exact",
    ],
    studyOrder: 13,
    difficulty: "advanced",
    tags: ["criticality", "scaling", "fluctuations"],
  },
];

export const knowledgeItems: KnowledgeItem[] = [
  ...coreKnowledgeItems,
  ...supplementalKnowledgeItems,
];

export function getKnowledgeByCourse(courseId: CourseId) {
  return knowledgeItems
    .filter((item) => item.course === courseId)
    .sort((a, b) => a.studyOrder - b.studyOrder);
}

export function getKnowledgeItem(id?: string) {
  if (!id) return undefined;

  const normalized = id.trim().toLowerCase();

  return knowledgeItems.find((item) => {
    if (item.id === id || item.title.toLowerCase() === normalized) return true;

    return item.alias?.some((alias) => alias.toLowerCase() === normalized);
  });
}

export function getKnowledgeTitle(id?: string) {
  return getKnowledgeItem(id)?.title ?? id ?? "";
}

export function getRelatedKnowledgeItems(item?: KnowledgeItem) {
  if (!item) return [];

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
