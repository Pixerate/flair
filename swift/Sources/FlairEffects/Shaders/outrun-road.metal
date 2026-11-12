// flair-metal-hash: efe15229
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float uPixel;
    float uSpeed;
    float uCurve;
    float3 uSkyTop;
    float3 uSkyBottom;
    float3 uSunTop;
    float3 uSunBottom;
    float3 uGrass;
    float3 uRoad;
    float3 uKerb;
};

struct flair_outrun_road_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float bayer2(thread float2& a)
{
    a = floor(a);
    return fract((a.x / 2.0) + ((a.y * a.y) * 0.75));
}

static inline __attribute__((always_inline))
float bayer4(thread const float2& a)
{
    float2 param = a * 0.5;
    float _86 = bayer2(param);
    float2 param_1 = a;
    float _91 = bayer2(param_1);
    return (_86 * 0.25) + _91;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float _noise1(thread const float& x, thread const float& seed)
{
    float i = floor(x);
    float f = fract(x);
    f = (f * f) * (3.0 - (2.0 * f));
    float2 param = float2(i, seed);
    float2 param_1 = float2(i + 1.0, seed);
    return mix(hash12(param), hash12(param_1), f);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _136)
{
    float2 cell = floor(fragCoord / float2(_136.uPixel));
    float2 grid = fast::max(floor(float2(_136.iResolution[0], _136.iResolution[1]) / float2(_136.uPixel)), float2(1.0));
    float horizon = floor(grid.y * 0.4600000083446502685546875);
    float t = _136.iTime * _136.uSpeed;
    float curve = _136.uCurve * sin(_136.iTime * 0.319999992847442626953125);
    float cx = floor(grid.x * 0.5);
    float3 col;
    if (cell.y >= horizon)
    {
        float h = (cell.y - horizon) / fast::max(grid.y - horizon, 1.0);
        float2 param = cell;
        float band = fast::clamp(floor((h * 7.0) + ((bayer4(param) - 0.5) * 0.800000011920928955078125)), 0.0, 6.0) / 6.0;
        col = mix(_136.uSkyBottom, _136.uSkyTop, float3(band));
        float r = floor(grid.y * 0.20000000298023223876953125);
        float2 sc = float2(floor(cx - ((curve * grid.x) * 0.25)), horizon + floor(r * 0.550000011920928955078125));
        float2 d = cell - sc;
        if (dot(d, d) <= ((r * r) + r))
        {
            float below = -d.y;
            bool _274 = below > 0.0;
            bool _288;
            if (_274)
            {
                _288 = mod(below, 5.0) < floor(((below / r) * 4.0) + 0.5);
            }
            else
            {
                _288 = _274;
            }
            bool gap = _288;
            if (!gap)
            {
                col = mix(_136.uSunBottom, _136.uSunTop, float3(fast::clamp(floor((((d.y / r) * 0.5) + 0.5) * 4.0) / 3.0, 0.0, 1.0)));
            }
        }
        float param_1 = (cell.x + floor((curve * grid.x) * 0.4000000059604644775390625)) * 0.070000000298023223876953125;
        float param_2 = 3.0;
        float hills = floor(2.0 + (5.0 * _noise1(param_1, param_2)));
        if (cell.y < (horizon + hills))
        {
            col = mix(_136.uSkyTop, _136.uGrass, float3(0.25));
        }
    }
    else
    {
        float dy = horizon - cell.y;
        float scale = dy / horizon;
        float z = 1.0 / scale;
        float roadX = cx + ((((curve * grid.x) * 0.60000002384185791015625) * (1.0 - scale)) * (1.0 - scale));
        float halfW = (grid.x * 0.4199999868869781494140625) * scale;
        float dx = abs(cell.x - roadX);
        float alt = mod(floor((z + (t * 10.0)) * 0.5), 2.0);
        col = _136.uGrass * ((alt > 0.5) ? 1.0 : 0.800000011920928955078125);
        if (dx < halfW)
        {
            col = _136.uRoad * ((alt > 0.5) ? 1.0 : 0.89999997615814208984375);
            float lane = abs(dx - (halfW / 3.0));
            bool _421 = alt > 0.5;
            bool _439;
            if (_421)
            {
                bool _429 = lane < fast::max(0.5, halfW * 0.02500000037252902984619140625);
                bool _438;
                if (!_429)
                {
                    _438 = dx < fast::max(0.5, halfW * 0.02500000037252902984619140625);
                }
                else
                {
                    _438 = _429;
                }
                _439 = _438;
            }
            else
            {
                _439 = _421;
            }
            if (_439)
            {
                col = float3(0.949999988079071044921875);
            }
        }
        else
        {
            if (dx < (halfW * 1.12000000476837158203125))
            {
                float3 _454;
                if (alt > 0.5)
                {
                    _454 = _136.uKerb;
                }
                else
                {
                    _454 = float3(0.949999988079071044921875);
                }
                col = _454;
            }
        }
        float haze = fast::clamp(1.0 - (scale * 6.0), 0.0, 1.0);
        float2 param_3 = cell;
        if (bayer4(param_3) < (haze * 0.800000011920928955078125))
        {
            col = _136.uSkyBottom * 0.800000011920928955078125;
        }
    }
    float _583;
    float3 _617;
    float3 _631;
    for (int k = 7; k >= 0; k--)
    {
        float period = 8.0;
        float zk = ((float(k) * period) + period) - mod(t * 10.0, period);
        if (zk < 1.0)
        {
            continue;
        }
        float sk = 1.0 / zk;
        float yb = horizon - (sk * horizon);
        float roadX_1 = cx + ((((curve * grid.x) * 0.60000002384185791015625) * (1.0 - sk)) * (1.0 - sk));
        float off = ((grid.x * 0.4199999868869781494140625) * sk) * 1.35000002384185791015625;
        float w = fast::max(1.0, floor(((grid.x * 0.01200000010430812835693359375) * sk) + 0.5));
        float ph = floor((grid.y * 0.4199999868869781494140625) * sk) + 2.0;
        float py = cell.y - floor(yb);
        if ((py >= 0.0) && (py < ph))
        {
            for (int side = 0; side < 2; side++)
            {
                if (side == 0)
                {
                    _583 = -off;
                }
                else
                {
                    _583 = off;
                }
                float px = floor(roadX_1 + _583);
                bool _596 = cell.x >= px;
                bool _605;
                if (_596)
                {
                    _605 = cell.x < (px + w);
                }
                else
                {
                    _605 = _596;
                }
                if (_605)
                {
                    if (py > (ph - fast::max(1.0, floor(w * 1.5))))
                    {
                        _617 = _136.uSunTop;
                    }
                    else
                    {
                        if (mod(floor(py / fast::max(1.0, w * 2.0)), 2.0) < 1.0)
                        {
                            _631 = float3(0.949999988079071044921875);
                        }
                        else
                        {
                            _631 = _136.uKerb;
                        }
                        _617 = _631;
                    }
                    col = _617;
                }
            }
        }
    }
    fragColor = float4(col, 1.0);
}

fragment flair_outrun_road_frag_out flair_outrun_road_frag(constant FlairUniforms& _136 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_outrun_road_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _660;
    if (_136.flair_flipY > 0.5)
    {
        _660 = _136.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _660 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _660);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _136);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

