// flair-metal-hash: c0888db3
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

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
    float uCells;
    float uLead;
    char _m15_pad[8];
    packed_float3 uLeadColor;
    float uSaturation;
    float uTexture;
    float uLight;
    float uJitter;
    char _m20_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_image_stained_glass_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float4 voronoiBorder(thread const float2& p, thread const float& jitter)
{
    float2 n = floor(p);
    float2 f = fract(p);
    float2 mg = float2(0.0);
    float2 mr = float2(0.0);
    float md = 8.0;
    for (int j = -1; j <= 1; j++)
    {
        for (int i = -1; i <= 1; i++)
        {
            float2 g = float2(float(i), float(j));
            float2 param = n + g;
            float2 r = ((g + float2(0.5)) + ((hash22(param) - float2(0.5)) * jitter)) - f;
            float d = dot(r, r);
            if (d < md)
            {
                md = d;
                mr = r;
                mg = g;
            }
        }
    }
    md = 8.0;
    for (int j_1 = -2; j_1 <= 2; j_1++)
    {
        for (int i_1 = -2; i_1 <= 2; i_1++)
        {
            float2 g_1 = mg + float2(float(i_1), float(j_1));
            float2 param_1 = n + g_1;
            float2 r_1 = ((g_1 + float2(0.5)) + ((hash22(param_1) - float2(0.5)) * jitter)) - f;
            float2 between = r_1 - mr;
            if (dot(between, between) > 9.9999997473787516355514526367188e-06)
            {
                md = fast::min(md, dot((mr + r_1) * 0.5, fast::normalize(between)));
            }
        }
    }
    float2 param_2 = n + mg;
    float2 param_3 = n + mg;
    return float4(((n + mg) + float2(0.5)) + ((hash22(param_2) - float2(0.5)) * jitter), md, hash12(param_3));
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _242)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_242.uBackdrop) * _242.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_242.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float4 pictureBlurRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float& blurPx, constant FlairUniforms& _242)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    if (size.x <= 1.0)
    {
        float2 param = fract(uv);
        return float4(testCard(param), 1.0);
    }
    float4 param_1 = tex.sample(texSmplr, uv, level(log2(fast::max((blurPx * size.x) / _242.iResolution[0u], 1.0))));
    return overBackdrop(param_1, _242);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _242, texture2d<float> uImage, sampler uImageSmplr)
{
    float px = 1.0 / _242.iResolution[1u];
    float2 q = (fragCoord * px) * _242.uCells;
    float2 param = q;
    float param_1 = _242.uJitter;
    float4 v = voronoiBorder(param, param_1);
    float2 seedUv = ((v.xy / float2(_242.uCells)) / float2(px)) / float2(_242.iResolution[0], _242.iResolution[1]);
    float2 param_2 = seedUv;
    float param_3 = 0.3499999940395355224609375 / (_242.uCells * px);
    float4 pane = pictureBlurRGBA(uImage, uImageSmplr, param_2, param_3, _242);
    float3 glass = pane.xyz;
    float luma = dot(glass, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625));
    glass = fast::clamp(mix(float3(luma), glass, float3(_242.uSaturation)), float3(0.0), float3(1.0));
    float2 param_4 = (q * 1.7999999523162841796875) + float2(v.w * 11.0);
    int param_5 = 4;
    float _646 = fbm(param_4, param_5);
    glass *= mix(1.0, 0.699999988079071044921875 + (0.550000011920928955078125 * _646), _242.uTexture);
    float2 c = (fragCoord / float2(_242.iResolution[0], _242.iResolution[1])) - float2(0.5);
    glass *= (_242.uLight * (1.0499999523162841796875 - (0.449999988079071044921875 * dot(c, c))));
    float cell = _242.uCells * px;
    float half_ = 0.5 * _242.uLead;
    float lead = 1.0 - smoothstep(half_, half_ + (1.5 * cell), v.z);
    glass *= (0.7799999713897705078125 + (0.2199999988079071044921875 * smoothstep(half_, (half_ * 3.0) + 0.0199999995529651641845703125, v.z)));
    float3 came = float3(_242.uLeadColor) * (0.699999988079071044921875 + (0.60000002384185791015625 * smoothstep(half_, 0.0, v.z)));
    float3 col = mix(glass, came, float3(lead));
    fragColor = float4(col, fast::max(pane.w, lead * pane.w));
}

fragment flair_image_stained_glass_frag_out flair_image_stained_glass_frag(constant FlairUniforms& _242 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_stained_glass_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _752;
    if (_242.flair_flipY > 0.5)
    {
        _752 = _242.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _752 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _752);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _242, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

